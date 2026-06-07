import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Timeline({ student }) {
  const [historyThread, setHistoryThread] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorLog, setErrorLog] = useState(null);

  // Track text input states for each update card using the update ID as the key
  const [replyTexts, setReplyTexts] = useState({});
  const [submittingReply, setSubmittingReply] = useState({});

  useEffect(() => {
    if (student?.id) {
      loadUpdateHistoryAndComments();
    }
  }, [student]);

  const loadUpdateHistoryAndComments = async () => {
    setLoading(true);
    setErrorLog(null);

    try {
      const { data: updates, error: updateError } = await supabase
        .from("updates")
        .select("*")
        .eq("user_id", student.id)
        .eq("update_type", "progress")
        .order("created_at", { ascending: false });

      if (updateError) throw updateError;

      if (updates && updates.length > 0) {
        const updateIds = updates.map((u) => u.id);

        const { data: comments, error: commentError } = await supabase
          .from("comments")
          .select("*")
          .in("update_id", updateIds)
          .order("created_at", { ascending: true });

        if (commentError) throw commentError;

        const threadedData = updates.map((update) => ({
          ...update,
          comments: comments
            ? comments.filter((c) => c.update_id === update.id)
            : [],
        }));

        setHistoryThread(threadedData);
      } else {
        setHistoryThread([]);
      }
    } catch (err) {
      console.error("Error syncing student updates history:", err);
      setErrorLog(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Updated Method: Post Student Comment ───────────────────────────
  const handlePostStudentComment = async (updateId) => {
    const textToPost = replyTexts[updateId]?.trim();
    if (!textToPost) return;

    setSubmittingReply((prev) => ({ ...prev, [updateId]: true }));

    try {
      const { error } = await supabase.from("comments").insert({
        id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
        update_id: updateId, // Links comment directly to progress card
        text: textToPost, // The reply body content
        professor_name: null, // Left null so database flags it as student-originated
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Clear the input box for this specific card
      setReplyTexts((prev) => ({ ...prev, [updateId]: "" }));

      // Instantly reload feed history thread lines to show your comment
      await loadUpdateHistoryAndComments();
    } catch (err) {
      alert("Failed to send comment: " + err.message);
    } finally {
      setSubmittingReply((prev) => ({ ...prev, [updateId]: false }));
    }
  };

  if (loading) {
    return (
      <div
        className="empty"
        style={{ padding: "40px 20px", textAlign: "center", color: "#666" }}
      >
        <div className="empty-icon" style={{ fontSize: 24, marginBottom: 8 }}>
          ⏳
        </div>
        <div className="empty-text" style={{ fontSize: 14 }}>
          Syncing your project history...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div
          className="section-header"
          style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}
        >
          Your Project Logs & Reviews
        </div>
        <button
          onClick={loadUpdateHistoryAndComments}
          style={{
            background: "none",
            border: "none",
            color: "#a78bfa",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          🔄 Refresh Feed
        </button>
      </div>

      {errorLog && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            borderRadius: 6,
            padding: 10,
            color: "#f87171",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <strong>Sync Error:</strong> {errorLog}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {historyThread.map((update) => (
          <div
            key={update.id}
            className="card"
            style={{
              background: "#111118",
              border: "1px solid #222230",
              borderRadius: 10,
              padding: 14,
            }}
          >
            {/* Header Meta Info */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#a78bfa",
                  background: "rgba(167,139,250,0.1)",
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {update.title}
              </span>
              <span style={{ fontSize: 11, color: "#555" }}>
                {timeAgo(update.created_at)}
              </span>
            </div>

            {/* Main Log Content */}
            <div
              style={{
                fontSize: 13,
                color: "#ccc",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                marginBottom: 12,
              }}
            >
              {update.content}
            </div>

            {/* Render Photos/Videos */}
            {update.photo_urls?.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {update.photo_urls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    style={{
                      width: "100%",
                      maxHeight: 160,
                      borderRadius: 6,
                      objectFit: "cover",
                    }}
                  />
                ))}
              </div>
            )}
            {update.video_urls?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {update.video_urls.map((url, i) => (
                  <video
                    key={i}
                    src={url}
                    controls
                    style={{ width: "100%", maxHeight: 180, borderRadius: 6 }}
                  />
                ))}
              </div>
            )}

            {/* Combined Conversation Container */}
            <div
              style={{
                background: "#0b0b10",
                borderRadius: 8,
                padding: "10px 12px",
                borderLeft: "3px solid #7c3aed",
                marginTop: 8,
              }}
            >
              {/* Comment Feed Loop */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#666",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Discussion Thread
                </div>

                {update.comments.map((comment) => {
                  // If professor_name exists and is not null, it's a teacher comment
                  const isProfessor =
                    comment.professor_name !== null &&
                    comment.professor_name !== undefined;
                  return (
                    <div
                      key={comment.id}
                      style={{ borderTop: "1px solid #1a1a24", paddingTop: 6 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 11,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color: isProfessor ? "#a78bfa" : "#34d399",
                          }}
                        >
                          {isProfessor
                            ? `👨‍🏫 ${comment.professor_name}`
                            : `👤 Me`}
                        </span>
                        <span style={{ color: "#444" }}>
                          {timeAgo(comment.created_at)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#ddd",
                          lineHeight: 1.4,
                          marginTop: 4,
                        }}
                      >
                        {comment.text}
                      </div>
                    </div>
                  );
                })}

                {update.comments.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#444",
                      fontStyle: "italic",
                      paddingBottom: 4,
                    }}
                  >
                    No comments in this thread yet.
                  </div>
                )}
              </div>

              {/* Action Form: Reply Input Box */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  borderTop: "1px solid #1c1c27",
                  paddingTop: 8,
                  marginTop: 4,
                }}
              >
                <input
                  type="text"
                  placeholder="Send a comment/reply to professor..."
                  value={replyTexts[update.id] || ""}
                  onChange={(e) =>
                    setReplyTexts((prev) => ({
                      ...prev,
                      [update.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" && handlePostStudentComment(update.id)
                  }
                  disabled={submittingReply[update.id]}
                  style={{
                    flex: 1,
                    background: "#12121a",
                    border: "1px solid #222",
                    borderRadius: 4,
                    padding: "6px 10px",
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <button
                  onClick={() => handlePostStudentComment(update.id)}
                  disabled={
                    submittingReply[update.id] || !replyTexts[update.id]?.trim()
                  }
                  style={{
                    background: "#7c3aed",
                    border: "none",
                    borderRadius: 4,
                    color: "#fff",
                    padding: "0 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 500,
                    opacity:
                      !replyTexts[update.id]?.trim() ||
                      submittingReply[update.id]
                        ? 0.5
                        : 1,
                  }}
                >
                  {submittingReply[update.id] ? "..." : "Reply"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
