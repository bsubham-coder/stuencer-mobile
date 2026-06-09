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
  const [capturedPhoto, setCapturedPhoto] = useState(null); // blob after snap
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null); // preview URL

  const videoRef = useRef();
  const mediaRecorderRef = useRef();
  const chunksRef = useRef([]);
  const timerRef = useRef();

  const handleSuccessUpload = () => {
    setSavedCount((c) => c + 1);
    setNote("");
    setCapturedPhoto(null);
    setCapturedPhotoUrl(null);
    stopStream();
    setMode("menu");
    setSaving(false);
    if (typeof onUpdateSubmitted === "function") onUpdateSubmitted();
  };

  const stopStream = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  const handleBack = () => {
    stopStream();
    setRecording(false);
    clearInterval(timerRef.current);
    setCapturedPhoto(null);
    setCapturedPhotoUrl(null);
    setNote("");
    setMode("menu");
  };

  // ── PHOTO: Open camera fullscreen ──────────────────────────
  const handleTakePhoto = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      setStream(mediaStream);
      setMode("camera"); // fullscreen camera view
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

  // ── PHOTO: Snap — capture frame, stop camera, show preview ──
  const handleSnap = () => {
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedPhoto(blob);
        setCapturedPhotoUrl(URL.createObjectURL(blob));
        stopStream(); // stop camera after snap
        setMode("photo_preview"); // go to preview + note screen
      },
      "image/jpeg",
      0.85,
    );
  };

  // ── PHOTO: Save with note ───────────────────────────────────
  const handleSavePhoto = async () => {
    if (!capturedPhoto) return;
    setSaving(true);

    const fileName = `${generateId()}.jpg`;
    const { error } = await supabase.storage
      .from("captures")
      .upload(`photos/${fileName}`, capturedPhoto, {
        contentType: "image/jpeg",
      });

    if (error) {
      alert("Upload failed: " + error.message);
      setSaving(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("captures")
      .getPublicUrl(`photos/${fileName}`);

    const { error: dbError } = await supabase.from("captures").insert({
      id: generateId(),
      project_id: project?.id || null,
      text: note.trim() || "Photo capture",
      stage: stage.name,
      type: captureType.name,
      image_path: urlData.publicUrl,
      timestamp: Date.now(),
      user_id: student.id,
      user_name: student.name,
      source: "mobile",
    });

    if (dbError) {
      alert("Save failed: " + dbError.message);
      setSaving(false);
      return;
    }

    handleSuccessUpload();
  };

  // ── VIDEO: Open camera ──────────────────────────────────────
  const handleTakeVideo = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      setStream(mediaStream);
      setMode("video_camera");
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
    recorder.onstop = () => {
      stopStream();
      setMode("video_preview"); // go to note screen after recording
    };
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

  const handleSaveVideo = async () => {
    setSaving(true);
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const fileName = `${generateId()}.webm`;

    const { error } = await supabase.storage
      .from("captures")
      .upload(`videos/${fileName}`, blob, { contentType: "video/webm" });

    if (error) {
      alert("Upload failed: " + error.message);
      setSaving(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("captures")
      .getPublicUrl(`videos/${fileName}`);

    const { error: dbError } = await supabase.from("captures").insert({
      id: generateId(),
      project_id: project?.id || null,
      text: note.trim() || "Video capture",
      stage: stage.name,
      type: captureType.name,
      image_path: urlData.publicUrl,
      timestamp: Date.now(),
      user_id: student.id,
      user_name: student.name,
      source: "mobile",
    });

    if (dbError) {
      alert("Save failed: " + dbError.message);
      setSaving(false);
      return;
    }

    handleSuccessUpload();
  };

  // ── NOTE ────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("captures").insert({
        id: generateId(),
        project_id: project?.id || null,
        text: note.trim(),
        stage: stage.name,
        type: captureType.name,
        image_path: null,
        timestamp: Date.now(),
        user_id: student.id,
        user_name: student.name,
        source: "mobile",
      });
      if (error) throw error;
      handleSuccessUpload();
    } catch (err) {
      alert("Error: " + err.message);
      setSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // FULLSCREEN CAMERA — Photo
  // ══════════════════════════════════════════════════════════════
  if (mode === "camera") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Camera feed — takes full screen */}
        <video
          ref={videoRef}
          style={{
            flex: 1,
            width: "100%",
            objectFit: "cover",
          }}
          muted
          playsInline
        />

        {/* Bottom controls */}
        <div
          style={{
            padding: "24px 32px",
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Cancel */}
          <button
            onClick={handleBack}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "50%",
              width: 48,
              height: 48,
              color: "#fff",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ✕
          </button>

          {/* Shutter button */}
          <button
            onClick={handleSnap}
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#fff",
              border: "4px solid rgba(255,255,255,0.3)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />

          {/* Spacer */}
          <div style={{ width: 48 }} />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // PHOTO PREVIEW + NOTE
  // ══════════════════════════════════════════════════════════════
  if (mode === "photo_preview") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0b0b10",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid #222",
            background: "#111118",
          }}
        >
          <button
            onClick={handleBack}
            style={{
              background: "none",
              border: "none",
              color: "#a78bfa",
              fontSize: 20,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ←
          </button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
            Add Note & Save
          </div>
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          {/* Photo preview */}
          {capturedPhotoUrl && (
            <img
              src={capturedPhotoUrl}
              alt=""
              style={{
                width: "100%",
                borderRadius: 12,
                marginBottom: 16,
                maxHeight: 300,
                objectFit: "cover",
              }}
            />
          )}

          {/* Inlined Type Selector */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Type
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

          {/* Inlined Note Input */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Add Note
            </div>
            <textarea
              className="input"
              rows={4}
              placeholder="Type your notes or description here..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: "100%",
                background: "#14141c",
                color: "#fff",
                border: "1px solid #2a2a3a",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 14,
                lineHeight: "1.5",
                resize: "vertical",
                outline: "none",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                fontFamily: "inherit",
              }}
              autoFocus
            />
          </div>

          <button
            className="btn btn-success"
            onClick={handleSavePhoto}
            disabled={saving}
            style={{ width: "100%", padding: 14, fontSize: 15 }}
          >
            {saving ? "Saving..." : "✅ Save Photo"}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // FULLSCREEN CAMERA — Video
  // ══════════════════════════════════════════════════════════════
  if (mode === "video_camera") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <video
          ref={videoRef}
          style={{ flex: 1, width: "100%", objectFit: "cover" }}
          muted
          playsInline
        />

        {recording && (
          <div
            style={{
              position: "absolute",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(239,68,68,0.9)",
              color: "#fff",
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ● REC {timeLeft}s
          </div>
        )}

        <div
          style={{
            padding: "24px 32px",
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={handleBack}
            disabled={recording}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "50%",
              width: 48,
              height: 48,
              color: recording ? "#555" : "#fff",
              fontSize: 18,
              cursor: recording ? "default" : "pointer",
            }}
          >
            ✕
          </button>

          {/* Record / Stop button */}
          {!recording ? (
            <button
              onClick={handleRecordVideo}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "#ef4444",
                border: "4px solid rgba(255,255,255,0.3)",
                cursor: "pointer",
              }}
            />
          ) : (
            <button
              onClick={handleStopRecording}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "#fff",
                border: "4px solid rgba(255,255,255,0.3)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  background: "#ef4444",
                  borderRadius: 4,
                }}
              />
            </button>
          )}

          <div style={{ width: 48 }} />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // VIDEO PREVIEW + NOTE
  // ══════════════════════════════════════════════════════════════
  if (mode === "video_preview") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0b0b10",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid #222",
            background: "#111118",
          }}
        >
          <button
            onClick={handleBack}
            style={{
              background: "none",
              border: "none",
              color: "#a78bfa",
              fontSize: 20,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ←
          </button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
            Add Note & Save
          </div>
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          {/* Video preview */}
          <div
            style={{
              background: "#111",
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 28 }}>🎥</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                Video recorded
              </div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                {60 - timeLeft}s · Ready to save
              </div>
            </div>
          </div>

          {/* Inlined Type Selector */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Type
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

          {/* Inlined Note Input */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Add Note
            </div>
            <textarea
              className="input"
              rows={4}
              placeholder="Type your notes or description here..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: "100%",
                background: "#14141c",
                color: "#fff",
                border: "1px solid #2a2a3a",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 14,
                lineHeight: "1.5",
                resize: "vertical",
                outline: "none",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                fontFamily: "inherit",
              }}
              autoFocus
            />
          </div>

          <button
            className="btn btn-success"
            onClick={handleSaveVideo}
            disabled={saving}
            style={{ width: "100%", padding: 14, fontSize: 15 }}
          >
            {saving ? "Uploading video..." : "✅ Save Video"}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // NOTE MODE
  // ══════════════════════════════════════════════════════════════
  if (mode === "note") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0b0b10",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid #222",
            background: "#111118",
          }}
        >
          <button
            onClick={handleBack}
            style={{
              background: "none",
              border: "none",
              color: "#a78bfa",
              fontSize: 20,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ←
          </button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
            Write Note
          </div>
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          {/* Inlined Type Selector */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Type
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

          {/* Inlined Note Input */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Add Note
            </div>
            <textarea
              className="input"
              rows={4}
              placeholder="Type your notes or description here..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: "100%",
                background: "#14141c",
                color: "#fff",
                border: "1px solid #2a2a3a",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 14,
                lineHeight: "1.5",
                resize: "vertical",
                outline: "none",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                fontFamily: "inherit",
              }}
              autoFocus
            />
          </div>

          <button
            className="btn btn-success"
            onClick={handleSaveNote}
            disabled={saving || !note.trim()}
            style={{ width: "100%", padding: 14, fontSize: 15 }}
          >
            {saving ? "Saving..." : "✅ Save Note"}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // MAIN MENU
  // ══════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        padding: 16,
        background: "#0b0b10",
        color: "#fff",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
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

      {/* Action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          onClick={handleTakePhoto}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 20px",
            borderRadius: 14,
            background: "#111118",
            border: "1px solid #222230",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "rgba(124,58,237,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            📷
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
              Take Photo
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>
              Snap a photo then add your note
            </div>
          </div>
        </button>

        <button
          onClick={handleTakeVideo}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 20px",
            borderRadius: 14,
            background: "#111118",
            border: "1px solid #222230",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "rgba(239,68,68,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            🎥
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
              Record Video
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>
              Up to 60 seconds then add your note
            </div>
          </div>
        </button>

        <button
          onClick={() => setMode("note")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 20px",
            borderRadius: 14,
            background: "#111118",
            border: "1px solid #222230",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "rgba(34,197,94,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            ✍️
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
              Write Note
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>
              Text observation or finding
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
