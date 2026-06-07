import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { CAPTURE_TYPES } from "../lib/constants";

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function Session({
  student,
  project,
  stage,
  onStop,
  onUpdateSubmitted,
}) {
  const [mode, setMode] = useState("menu");
  const [note, setNote] = useState("");
  const [captureType, setCaptureType] = useState(CAPTURE_TYPES[0]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  const videoRef = useRef();
  const mediaRecorderRef = useRef();
  const chunksRef = useRef([]);
  const timerRef = useRef();

  // Helper function to handle post-success cleanup and trigger timeline sync
  const handleSuccessUpload = () => {
    setSavedCount((c) => c + 1);
    setNote("");
    stopStream();
    setMode("menu");
    setSaving(false);

    // Trigger callback to parent layout to let Timeline.jsx know it should refetch data
    if (typeof onUpdateSubmitted === "function") {
      onUpdateSubmitted();
    }
  };

  // ── Photo Handling ─────────────────────────────────────────────
  const handleTakePhoto = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(mediaStream);
      setMode("photo");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      alert("Camera access denied.");
    }
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    setSaving(true);

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          alert("Failed to process photo stream capture.");
          setSaving(false);
          return;
        }

        const fileName = `${generateId()}.jpg`;
        const { error } = await supabase.storage
          .from("captures")
          .upload(`photos/${fileName}`, blob, { contentType: "image/jpeg" });

        if (error) {
          alert("Upload failed");
          setSaving(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("captures")
          .getPublicUrl(`photos/${fileName}`);

        const { error: dbError } = await supabase.from("updates").insert({
          id: generateId(),
          project_id: project?.id || null,
          title: `${captureType.emoji} ${captureType.name} - ${stage.name}`,
          content: note.trim() || "Photo progress snapshot",
          status: "sent",
          update_type: "progress",
          photo_urls: [urlData.publicUrl],
          video_urls: [],
          created_at: new Date().toISOString(),
          user_id: student.id,
          user_name: student.name,
        });

        if (dbError) {
          alert(`Database save failed: ${dbError.message}`);
          setSaving(false);
          return;
        }

        handleSuccessUpload();
      },
      "image/jpeg",
      0.85,
    );
  };

  // ── Video Handling ─────────────────────────────────────────────
  const handleStartVideo = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      setStream(mediaStream);
      setMode("video");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      alert("Camera/mic access denied.");
    }
  };

  const handleRecordVideo = () => {
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = handleVideoSave;
    recorder.start();
    setRecording(true);
    setTimeLeft(60);

    let seconds = 60;
    timerRef.current = setInterval(() => {
      seconds -= 1;
      setTimeLeft(seconds);
      if (seconds <= 0) {
        clearInterval(timerRef.current);
        handleStopRecording();
      }
    }, 1000);
  };

  const handleStopRecording = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleVideoSave = async () => {
    setSaving(true);
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const fileName = `${generateId()}.webm`;

    const { error } = await supabase.storage
      .from("captures")
      .upload(`videos/${fileName}`, blob, { contentType: "video/webm" });

    if (error) {
      alert("Upload failed");
      setSaving(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("captures")
      .getPublicUrl(`videos/${fileName}`);

    const { error: dbError } = await supabase.from("updates").insert({
      id: generateId(),
      project_id: project?.id || null,
      title: `${captureType.emoji} ${captureType.name} Video Log`,
      content: note.trim() || "Video progress clip",
      status: "sent",
      update_type: "progress",
      photo_urls: [],
      video_urls: [urlData.publicUrl],
      created_at: new Date().toISOString(),
      user_id: student.id,
      user_name: student.name,
    });

    if (dbError) {
      alert(`Database save failed: ${dbError.message}`);
      setSaving(false);
      return;
    }

    handleSuccessUpload();
  };

  // ── Text Note Handling ──────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);

    try {
      const { error } = await supabase.from("updates").insert({
        id: generateId(),
        project_id: project?.id || null,
        title: `${captureType.emoji} Text Note - ${stage.name}`,
        content: note.trim(),
        status: "sent",
        update_type: "progress",
        photo_urls: [],
        video_urls: [],
        created_at: new Date().toISOString(),
        user_id: student?.id,
        user_name: student?.name,
      });

      if (error) throw error;
      handleSuccessUpload();
    } catch (err) {
      alert("Error saving note: " + err.message);
      setSaving(false);
    }
  };

  const stopStream = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  const handleBack = () => {
    stopStream();
    setRecording(false);
    clearInterval(timerRef.current);
    setMode("menu");
  };

  return (
    <div style={{ padding: "16px", background: "#0b0b10", color: "#fff" }}>
      {/* ── SECTION 1: HEADER BLOCK ────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {stage.emoji} {stage.name}
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
            {project.name} · {savedCount} updates sent
          </div>
        </div>
        <button
          className="btn btn-danger"
          style={{ width: "auto", padding: "8px 16px" }}
          onClick={onStop}
        >
          Stop Session
        </button>
      </div>

      {/* ── SECTION 2: INTERACTIVE ACTION CONTROLS ───────────────── */}
      <div
        style={{
          background: "#111118",
          border: "1px solid #222230",
          borderRadius: 12,
          padding: 14,
        }}
      >
        {/* Sub-view Media Output Windows */}
        {(mode === "photo" || mode === "video") && (
          <div style={{ marginBottom: 16 }}>
            <video
              ref={videoRef}
              style={{
                width: "100%",
                borderRadius: 12,
                background: "#000",
                maxHeight: 260,
                objectFit: "cover",
              }}
              muted
              playsInline
            />
            {mode === "video" && recording && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: 8,
                  color: "#ef4444",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                ● Recording — {timeLeft}s left
              </div>
            )}
          </div>
        )}

        {/* Global Metadata Form Input Panels */}
        {mode !== "menu" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div className="label">Capture Context Tag</div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                {CAPTURE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCaptureType(t)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 20,
                      border:
                        captureType.id === t.id
                          ? "1.5px solid #7c3aed"
                          : "1.5px solid #333",
                      background:
                        captureType.id === t.id
                          ? "rgba(124,58,237,0.15)"
                          : "#1a1a24",
                      color: captureType.id === t.id ? "#a78bfa" : "#888",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {t.emoji} {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="label">Add Notes / Log Details</div>
              <textarea
                className="input"
                rows={3}
                placeholder="What are you currently processing?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  marginTop: 6,
                  width: "100%",
                  background: "#0b0b10",
                  color: "#fff",
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: 8,
                }}
              />
            </div>
          </>
        )}

        {/* Action Form Conditionals */}
        {mode === "menu" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={handleTakePhoto}
              style={{ width: "100%", padding: "12px" }}
            >
              📷 Take Media Photo
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStartVideo}
              style={{ width: "100%", padding: "12px" }}
            >
              🎥 Record Video Entry
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setMode("note")}
              style={{ width: "100%", padding: "12px", background: "#1a1a24" }}
            >
              ✍️ Create Text Note Log
            </button>
          </div>
        )}

        {mode === "photo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              className="btn btn-success"
              onClick={handleCapturePhoto}
              disabled={saving}
            >
              {saving ? "Uploading Entry..." : "📸 Snap & Post Update"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleBack}
              style={{ background: "#222" }}
            >
              Cancel
            </button>
          </div>
        )}

        {mode === "video" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!recording ? (
              <button className="btn btn-danger" onClick={handleRecordVideo}>
                ● Start Recording
              </button>
            ) : (
              <button
                className="btn btn-ghost"
                onClick={handleStopRecording}
                style={{ background: "#ef4444", color: "#fff" }}
              >
                ■ End & Process Recording
              </button>
            )}
            {saving && (
              <div
                style={{
                  textAlign: "center",
                  color: "#a78bfa",
                  fontSize: 13,
                  padding: 4,
                }}
              >
                Uploading video stream file...
              </div>
            )}
            {!recording && !saving && (
              <button
                className="btn btn-ghost"
                onClick={handleBack}
                style={{ background: "#222" }}
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {mode === "note" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              className="btn btn-success"
              onClick={handleSaveNote}
              disabled={saving || !note.trim()}
            >
              {saving ? "Saving note..." : "✅ Submit Text Update"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleBack}
              style={{ background: "#222" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
