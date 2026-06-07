import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE",
});

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function GenerateUpdate({ student }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [files, setFiles] = useState([]);
  const [products, setProducts] = useState([]);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [step, setStep] = useState("select");

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", student.id)
      .order("created_at", { ascending: false });
    setProjects(data || []);
  };

  const loadDataSinceLastUpdate = async (projectId) => {
    const { data: lastUpdateData } = await supabase
      .from("updates")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", student.id)
      .order("created_at", { ascending: false })
      .limit(1);

    setLastUpdate(lastUpdateData?.[0] || null);

    // 🌟 FIX: Only fetch captures that haven't been linked to an update yet
    const { data: capturesData } = await supabase
      .from("captures")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", student.id)
      .is("update_id", null)
      .order("timestamp", { ascending: true });

    // Only fetch unlinked queue files
    const { data: filesData } = await supabase
      .from("files")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", student.id)
      .order("timestamp", { ascending: true });

    const { data: productsData } = await supabase
      .from("products")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", student.id)
      .order("timestamp", { ascending: true });

    return {
      filteredCaptures: capturesData || [],
      filteredFiles: filesData || [],
      filteredProducts: productsData || [],
    };
  };

  const handleSelectProject = async (project) => {
    setSelectedProject(project);
    const { filteredCaptures, filteredFiles, filteredProducts } =
      await loadDataSinceLastUpdate(project.id);
    setCaptures(filteredCaptures);
    setFiles(filteredFiles);
    setProducts(filteredProducts);
    setStep("select");
    setGeneratedContent("");
  };

  const handleGenerate = async () => {
    const totalItems = captures.length + files.length + products.length;
    if (totalItems === 0) {
      alert("No new activity since your last update.");
      return;
    }

    setIsGenerating(true);

    const photoCaptures = captures.filter(
      (c) => c.image_path && !c.image_path.includes(".webm"),
    );

    const capturesSummary =
      captures.length > 0
        ? `\nCAPTURES (${captures.length}):\n` +
          captures
            .map((c, i) => {
              const mediaTag = c.image_path
                ? c.image_path.includes(".webm")
                  ? "[VIDEO]"
                  : "[PHOTO]"
                : "[NOTE]";
              return `${i + 1}. ${mediaTag} [${c.stage}] ${c.text}`;
            })
            .join("\n")
        : "";

    const filesSummary =
      files.length > 0
        ? `\nFILES ATTACHED (${files.length}):\n` +
          files
            .map(
              (f, i) =>
                `${i + 1}. [${f.type.toUpperCase()}] ${f.name} - Stage: ${f.stage} - Note: ${f.note || "no description note"}`,
            )
            .join("\n")
        : "";

    const instructionsText = `You are helping an engineering student write a highly concise progress update for their professor.

Student: ${student.name}
Project: ${selectedProject.name}
Lab: Robotics Lab

--- RAW LOG DATA ---
${capturesSummary}
${filesSummary}

Write a structured, ultra-short progress update using clean, direct bullet points. 
- Eliminate all conversational fluff, long introductory explanations, signatures, and wordy filler sentences.
- Keep descriptions focused on raw engineering progress.
- Write in first person as the student.

Structure the update with these exact numbered sections:
1. SUMMARY (Strictly 1-2 sentences maximum summarizing core progress)
2. WHAT I DID (Short, direct bullet points listing tasks completed—reference specific logs or actions)
3. KEY FINDINGS (Brief bullets on structural mechanics baseline settings, measurements, or items finalized)
4. FILES SUBMITTED (Short list of design files handled, skip if empty)
5. CHALLENGES (Any mechanical or system design issues, write "None this period" if empty)
6. NEXT STEPS (Brief bullets outlining immediate action items)`;

    const geminiContents = [instructionsText];
    const photosToSend = photoCaptures.slice(0, 5);

    for (const photo of photosToSend) {
      try {
        const response = await fetch(photo.image_path);
        const blob = await response.blob();
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(blob);
        });

        const mimeType = blob.type || "image/jpeg";
        geminiContents.push(`Visual data context for phase row: ${photo.text}`);
        geminiContents.push({
          inlineData: { data: base64, mimeType: mimeType },
        });
      } catch (err) {
        console.error("Could not load and transform log photo context:", err);
      }
    }

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let responseText = null;
    let attempts = 2;

    for (let i = 0; i < attempts; i++) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: geminiContents,
          config: {
            maxOutputTokens: 1500,
            temperature: 0.2,
          },
        });

        if (response && response.text) {
          responseText = response.text;
          break;
        }
      } catch (err) {
        if (
          (err.status === 503 || err.message?.includes("503")) &&
          i < attempts - 1
        ) {
          console.warn(`API under temporary load spike (503). Retrying...`);
          await delay(1500);
          continue;
        }
        console.error("Critical Generation Engine Exception:", err);
        alert(`Generation failed: ${err.message}`);
        setIsGenerating(false);
        return;
      }
    }

    if (responseText) {
      setGeneratedContent(responseText);
      setStep("preview");
    } else {
      alert("Servers are handling a burst of requests. Please try again.");
    }
    setIsGenerating(false);
  };

  // 🟢 MAJOR FIX: Clear or mark files as processed and link them to the updates data row
  const handleSend = async () => {
    if (!generatedContent.trim()) return;
    setIsSending(true);

    const now = Date.now();
    const updateId = generateId();

    // Gather photo and video URLs from current captures state
    const photoUrls = captures
      .filter((c) => c.image_path && !c.image_path.includes(".webm"))
      .map((c) => c.image_path);

    const videoUrls = captures
      .filter((c) => c.image_path?.includes(".webm"))
      .map((c) => c.image_path);

    const linkedFilesMetadata = files.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      url: f.url || f.file_path || "",
    }));

    // 🌟 ADD THIS LOG RIGHT HERE:
    console.log(
      "--- DEBUG FILES METADATA BEFORE SENDING ---",
      linkedFilesMetadata,
    );

    // 1. Insert update into Supabase (Includes ALL your dashboard filters + media arrays)
    const { error } = await supabase.from("updates").insert({
      id: updateId,
      project_id: selectedProject.id,
      user_id: student.id,
      user_name: student.name,
      title: `${student.name.split(" ")[0]}'s Update — ${new Date().toLocaleDateString()}`,
      content: generatedContent,
      week_start: lastUpdate
        ? new Date(lastUpdate.created_at).getTime()
        : now - 7 * 24 * 60 * 60 * 1000,
      week_end: now,
      status: "sent",
      update_type: "progress",
      photo_urls: photoUrls,
      video_urls: videoUrls,
      files_attached: linkedFilesMetadata,
    });

    if (error) {
      alert("Failed to send update: " + error.message);
      setIsSending(false);
      return;
    }

    // 2. 🌟 NEW: Link current captures to this update so they disappear from the "new" queue
    if (captures.length > 0) {
      const captureIds = captures.map((c) => c.id);
      const { error: captureUpdateError } = await supabase
        .from("captures")
        .update({ update_id: updateId })
        .in("id", captureIds);

      if (captureUpdateError) {
        console.error(
          "Warning: Failed to mark captures as processed:",
          captureUpdateError,
        );
      }
    }

    // 3. Clear out the files queue from the table completely
    if (files.length > 0) {
      const fileIdsToDelete = files.map((f) => f.id);
      const { error: deleteError } = await supabase
        .from("files")
        .delete()
        .in("id", fileIdsToDelete);

      if (deleteError) {
        console.error(
          "Warning: Failed to clear files from queue:",
          deleteError,
        );
      }
    }

    // 4. Reset local component UI states
    setCaptures([]);
    setFiles([]);
    setProducts([]);
    setStep("sent");
    setIsSending(false);
  };

  const activePhotos = captures.filter(
    (c) => c.image_path && !c.image_path.includes(".webm"),
  );
  const totalItems = captures.length + files.length + products.length;

  if (step === "sent") {
    return (
      <div style={{ textAlign: "center", padding: "48px 16px" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 8,
          }}
        >
          Update Sent!
        </div>
        <div style={{ fontSize: 14, color: "#666", marginBottom: 32 }}>
          Your short progress brief has been committed to the dashboard logs.
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setStep("select");
            setSelectedProject(null);
            setGeneratedContent("");
            setCaptures([]);
            setFiles([]);
            setProducts([]);
          }}
        >
          Generate Another
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">Generate Update</div>

      <div className="card">
        <div className="label">Select Project</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8,
          }}
        >
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectProject(p)}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border:
                  selectedProject?.id === p.id
                    ? "1.5px solid #7c3aed"
                    : "1.5px solid #333",
                background:
                  selectedProject?.id === p.id
                    ? "rgba(124,58,237,0.1)"
                    : "#1a1a24",
                color: selectedProject?.id === p.id ? "#fff" : "#ccc",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {selectedProject && (
        <div className="card">
          <div className="label">Since Last Update</div>

          {totalItems === 0 ? (
            <div style={{ color: "#666", fontSize: 13, marginTop: 8 }}>
              No new engineering design work or captures logged in this interval
              window.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    background: "#1a1a30",
                    borderRadius: 8,
                    padding: "10px 8px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{ fontSize: 22, fontWeight: 700, color: "#a78bfa" }}
                  >
                    {captures.length}
                  </div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                    📷 captures
                  </div>
                  <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>
                    {activePhotos.length} photos ·{" "}
                    {captures.length - activePhotos.length} vids
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    background: "#1a2430",
                    borderRadius: 8,
                    padding: "10px 8px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{ fontSize: 22, fontWeight: 700, color: "#38bdf8" }}
                  >
                    {files.length}
                  </div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                    📎 files
                  </div>
                  <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>
                    {files.filter((f) => f.type === "pdf").length} PDFs ·{" "}
                    {files.filter((f) => f.type !== "pdf").length} CAD/Img
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    background: "#241a10",
                    borderRadius: 8,
                    padding: "10px 8px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}
                  >
                    {products.length}
                  </div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                    📦 procurement
                  </div>
                  <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>
                    {products.length} item total milestones
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  ...new Set([
                    ...captures.map((c) => c.stage),
                    ...files.map((f) => f.stage),
                    ...products.map((p) => p.stage),
                  ]),
                ]
                  .filter(Boolean)
                  .map((stage) => (
                    <span
                      key={stage}
                      style={{
                        fontSize: 11,
                        background: "#1a1a30",
                        border: "1px solid #333",
                        padding: "3px 8px",
                        borderRadius: 10,
                        color: "#888",
                      }}
                    >
                      {stage}
                    </span>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {step === "preview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="label">Generated Update</div>
            <textarea
              className="input"
              rows={14}
              value={generatedContent}
              onChange={(e) => setGeneratedContent(e.target.value)}
              style={{
                marginTop: 8,
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: "monospace",
              }}
            />
          </div>

          {/* Render files preview block inside the UI preview stack */}
          {files.length > 0 && (
            <div
              className="card"
              style={{ background: "#111622", borderColor: "#234" }}
            >
              <div
                className="label"
                style={{ color: "#38bdf8", marginBottom: 8 }}
              >
                📎 Attached Documents Queue ({files.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {files.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      fontSize: 12,
                      color: "#ccc",
                      display: "flex",
                      justifyContent: "space-between",
                      background: "rgba(255,255,255,0.02)",
                      padding: "6px 10px",
                      borderRadius: 6,
                    }}
                  >
                    <span>📄 {file.name}</span>
                    <span style={{ color: "#555", fontSize: 11 }}>
                      [{file.stage}]
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePhotos.length > 0 && (
            <div
              className="card"
              style={{ background: "#111116", borderColor: "#222" }}
            >
              <div
                className="label"
                style={{ color: "#f59e0b", marginBottom: 8 }}
              >
                🖼️ Linked Visual Attachments ({activePhotos.length})
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  overflowX: "auto",
                  paddingBottom: 8,
                }}
              >
                {activePhotos.map((photo, index) => (
                  <div
                    key={photo.id || index}
                    style={{
                      flex: "0 0 160px",
                      background: "#1e1e24",
                      borderRadius: 6,
                      padding: 6,
                      border: "1px solid #333",
                    }}
                  >
                    <img
                      src={photo.image_path}
                      alt="Lab Proof Asset"
                      style={{
                        width: "100%",
                        height: "100px",
                        objectFit: "cover",
                        borderRadius: 4,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 10,
                        color: "#aaa",
                        marginTop: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {photo.text || `Capture ${index + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedProject && totalItems > 0 && step === "select" && (
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "✨ Compiling Data Matrix..." : "✨ Generate with AI"}
        </button>
      )}

      {step === "preview" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8,
          }}
        >
          <button
            className="btn btn-success"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? "Sending..." : "📤 Send to Professor"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "Regenerating..." : "↺ Regenerate"}
          </button>
        </div>
      )}
    </div>
  );
}
