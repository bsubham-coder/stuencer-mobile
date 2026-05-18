import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { CAPTURE_TYPES } from "../lib/constants";

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function Session({ student, project, stage, onStop }) {
  const [mode, setMode] = useState("menu"); // menu | photo | video | note
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

  // ── Photo ──────────────────────────────────────────────────────
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
      alert("Camera access denied. Please allow camera in browser settings.");
    }
  };

  const handleCapturePhoto = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);

    canvas.toBlob(
      async (blob) => {
        setSaving(true);
        const fileName = `${generateId()}.jpg`;
        const { data, error } = await supabase.storage
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

        await supabase.from("captures").insert({
          id: generateId(),
          project_id: project.id,
          text: note.trim() || "Photo capture",
          stage: stage.name,
          type: captureType.name,
          image_path: urlData.publicUrl,
          timestamp: Date.now(),
          user_id: student.id,
          user_name: student.name,
          source: "mobile",
        });

        setSavedCount((c) => c + 1);
        setNote("");
        stopStream();
        setMode("menu");
        setSaving(false);
      },
      "image/jpeg",
      0.85,
    );
  };

  // ── Video ──────────────────────────────────────────────────────
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

    // Auto stop at 60 seconds
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

    await supabase.from("captures").insert({
      id: generateId(),
      project_id: project.id,
      text: note.trim() || "Video capture",
      stage: stage.name,
      type: captureType.name,
      image_path: urlData.publicUrl,
      timestamp: Date.now(),
      user_id: student.id,
      user_name: student.name,
      source: "mobile",
    });

    setSavedCount((c) => c + 1);
    setNote("");
    stopStream();
    setMode("menu");
    setSaving(false);
  };

  // ── Note ───────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);

    await supabase.from("captures").insert({
      id: generateId(),
      project_id: project.id,
      text: note.trim(),
      stage: stage.name,
      type: captureType.name,
      image_path: null,
      timestamp: Date.now(),
      user_id: student.id,
      user_name: student.name,
      source: "mobile",
    });

    setSavedCount((c) => c + 1);
    setNote("");
    setMode("menu");
    setSaving(false);
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

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div>
      {/* Session header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
            {stage.emoji} {stage.name}
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
            {project.name} · {savedCount} saved
          </div>
        </div>
        <button
          className="btn btn-danger"
          style={{ width: "auto", padding: "8px 16px" }}
          onClick={onStop}
        >
          Stop
        </button>
      </div>

      {/* Camera/video view */}
      {(mode === "photo" || mode === "video") && (
        <div style={{ marginBottom: 16 }}>
          <video
            ref={videoRef}
            style={{
              width: "100%",
              borderRadius: 12,
              background: "#000",
              maxHeight: 300,
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
                fontSize: 14,
              }}
            >
              ● Recording — {timeLeft}s left
            </div>
          )}
        </div>
      )}

      {/* Capture type selector */}
      {mode !== "menu" && (
        <div style={{ marginBottom: 12 }}>
          <div className="label">Capture Type</div>
          <div
            style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}
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
      )}

      {/* Note input */}
      {mode !== "menu" && (
        <div style={{ marginBottom: 12 }}>
          <div className="label">Add Note</div>
          <textarea
            className="input"
            rows={3}
            placeholder="What are you observing? What happened?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </div>
      )}

      {/* Action buttons */}
      {mode === "menu" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button className="btn btn-primary" onClick={handleTakePhoto}>
            📷 Take Photo
          </button>
          <button className="btn btn-primary" onClick={handleStartVideo}>
            🎥 Record Video
          </button>
          <button className="btn btn-ghost" onClick={() => setMode("note")}>
            ✍️ Write Note
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
            {saving ? "Saving..." : "📸 Capture Photo"}
          </button>
          <button className="btn btn-ghost" onClick={handleBack}>
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
            <button className="btn btn-ghost" onClick={handleStopRecording}>
              ■ Stop Recording
            </button>
          )}
          {saving && (
            <div style={{ textAlign: "center", color: "#888", fontSize: 13 }}>
              Uploading video...
            </div>
          )}
          {!recording && !saving && (
            <button className="btn btn-ghost" onClick={handleBack}>
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
            {saving ? "Saving..." : "✅ Save Note"}
          </button>
          <button className="btn btn-ghost" onClick={handleBack}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
