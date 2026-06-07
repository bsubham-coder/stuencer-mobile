import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { STUDENTS } from "../lib/constants";

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ProfessorDashboard({ professor }) {
  // ── Core state ─────────────────────────────────────────────
  const [view, setView] = useState("updates");
  const [loading, setLoading] = useState(true);

  // Data
  const [allUpdates, setAllUpdates] = useState([]);
  const [procurementUpdates, setProcurementUpdates] = useState([]);
  // Navigation
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedUpdate, setSelectedUpdate] = useState(null);

  // Comments
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);

  // Procurement approval

  const [isApproving, setIsApproving] = useState(false);

  // ── Load data ───────────────────────────────────────────────
  const loadAll = async () => {
    console.log("LOADING START");

    setLoading(true);

    try {
      await Promise.all([loadUpdates(), loadProcurementUpdates()]);

      console.log("LOADING DONE");
    } catch (err) {
      console.error("LOAD ALL ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadUpdates = async () => {
    const { data } = await supabase
      .from("updates")
      .select("*")
      .eq("status", "sent")
      .eq("update_type", "progress")
      .order("created_at", { ascending: false });
    setAllUpdates(data || []);
  };

  const loadProcurementUpdates = async () => {
    const { data } = await supabase
      .from("updates")
      .select("*")
      .eq("update_type", "procurement")
      .order("created_at", { ascending: false });

    setProcurementUpdates(data || []);
  };

  const loadComments = async (updateId) => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("update_id", updateId)
      .order("created_at", { ascending: true });
    setComments(data || []);
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ── Handlers ────────────────────────────────────────────────
  const handleSelectUpdate = async (update) => {
    setSelectedUpdate(update);
    await loadComments(update.id);
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    await supabase.from("comments").insert({
      id: Math.random().toString(36).slice(2),
      update_id: selectedUpdate.id,
      professor_id: professor.id,
      professor_name: professor.name,
      text: comment.trim(),
    });
    setComment("");
    await loadComments(selectedUpdate.id);
  };

  // ── Shared components ───────────────────────────────────────
  const BackButton = ({ onClick }) => (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "none",
        border: "none",
        color: "#a78bfa",
        fontSize: 14,
        cursor: "pointer",
        marginBottom: 16,
        padding: 0,
      }}
    >
      ← Back
    </button>
  );

  // ── VIEW: Procurement detail ────────────────────────────────

  // ── VIEW: Update detail ─────────────────────────────────────
  if (selectedUpdate) {
    const previousUpdates = allUpdates.filter(
      (u) => u.user_id === selectedUpdate.user_id && u.id !== selectedUpdate.id,
    );

    return (
      <div>
        <BackButton
          onClick={() => {
            setSelectedUpdate(null);
            setComments([]);
            setComment("");
          }}
        />

        {/* Header */}
        <div className="card">
          <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
            {timeAgo(selectedUpdate.created_at)}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 4,
            }}
          >
            {selectedUpdate.title}
          </div>
          <div style={{ fontSize: 13, color: "#a78bfa" }}>
            {selectedUpdate.user_name}
          </div>
        </div>

        {/* Content */}
        <div className="card">
          <div className="label">Update</div>
          <div
            style={{
              fontSize: 13,
              color: "#ccc",
              lineHeight: 1.7,
              marginTop: 8,
              whiteSpace: "pre-wrap",
            }}
          >
            {selectedUpdate.content}
          </div>
        </div>

        {/* Photos */}
        {selectedUpdate.photo_urls?.length > 0 && (
          <div className="card">
            <div className="label">
              Photos ({selectedUpdate.photo_urls.length})
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 8,
              }}
            >
              {selectedUpdate.photo_urls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  onClick={() => window.open(url, "_blank")}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    objectFit: "cover",
                    aspectRatio: "1",
                    background: "#000",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Videos */}
        {selectedUpdate.video_urls?.length > 0 && (
          <div className="card">
            <div className="label">
              Videos ({selectedUpdate.video_urls.length})
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 8,
              }}
            >
              {selectedUpdate.video_urls.map((url, i) => (
                <video
                  key={i}
                  src={url}
                  controls
                  style={{ width: "100%", borderRadius: 8 }}
                />
              ))}
            </div>
          </div>
        )}
        {/* Files Attached Section */}
        {(() => {
          // Parse the files array safely out of the JSON string structure
          let parsedFiles = [];
          try {
            if (selectedUpdate.files_attached) {
              parsedFiles =
                typeof selectedUpdate.files_attached === "string"
                  ? JSON.parse(selectedUpdate.files_attached)
                  : selectedUpdate.files_attached;
            }
          } catch (err) {
            console.error(
              "Failed to parse files_attached JSON array data:",
              err,
            );
          }

          // Only render the layout container card if files actually exist inside the array
          if (!Array.isArray(parsedFiles) || parsedFiles.length === 0)
            return null;

          return (
            <div className="card">
              <div className="label">
                Attached Documents ({parsedFiles.length})
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {parsedFiles.map((file) => {
                  // Normalize matching properties so it works whether keys are snake_case or camelCase
                  const targetUrl = file.url || file.file_path || file.filePath;

                  return (
                    <a
                      key={file.id || Math.random().toString()}
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        background: "#1a1a24",
                        borderRadius: 8,
                        textDecoration: "none",
                        border: "1px solid #222230",
                        transition: "border-color 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = "#7c3aed")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "#222230")
                      }
                    >
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#fff",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {file.name || "Untitled File"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#666",
                            textTransform: "uppercase",
                          }}
                        >
                          {file.type?.split("/")?.[1] || "document"}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: "#a78bfa" }}>
                        Open ↗
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {/* Comments */}
        <div className="card">
          <div className="label">Comments ({comments.length})</div>

          {comments.length === 0 ? (
            <div style={{ color: "#555", fontSize: 13, marginTop: 8 }}>
              No comments yet
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: "10px 12px",
                    background: "#1a1a24",
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{ fontSize: 11, color: "#a78bfa", marginBottom: 4 }}
                  >
                    {c.professor_name} · {timeAgo(c.created_at)}
                  </div>
                  <div style={{ fontSize: 13, color: "#ddd" }}>{c.text}</div>
                </div>
              ))}
            </div>
          )}

          <textarea
            className="input"
            rows={3}
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ marginTop: 12 }}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={handleComment}
            disabled={!comment.trim()}
          >
            Send Comment
          </button>
        </div>

        {/* Previous updates from same student */}
        {previousUpdates.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#555",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 10,
              }}
            >
              Previous updates from {selectedUpdate.user_name.split(" ")[0]}
            </div>
            {previousUpdates.map((update) => (
              <div
                key={update.id}
                className="card"
                onClick={() => handleSelectUpdate(update)}
                style={{ cursor: "pointer", opacity: 0.7 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    {update.title}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#555",
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {timeAgo(update.created_at)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#666",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {update.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── VIEW: Student updates list ──────────────────────────────
  if (selectedStudent) {
    const studentUpdates = allUpdates.filter(
      (u) => u.user_id === selectedStudent.id,
    );

    return (
      <div>
        <BackButton onClick={() => setSelectedStudent(null)} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(124,58,237,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            👤
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
              {selectedStudent.name}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {studentUpdates.length} update
              {studentUpdates.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {studentUpdates.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📭</div>
            <div className="empty-text">No updates yet</div>
            <div className="empty-sub">
              {selectedStudent.name.split(" ")[0]} hasn't sent any updates
            </div>
          </div>
        ) : (
          studentUpdates.map((update) => (
            <div
              key={update.id}
              className="card"
              onClick={() => handleSelectUpdate(update)}
              style={{ cursor: "pointer" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                  {update.title}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "#555",
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  {timeAgo(update.created_at)}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#666",
                  lineHeight: 1.5,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                {update.content}
              </div>
              <div style={{ fontSize: 11, color: "#a78bfa" }}>
                Tap to read & comment →
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // ── VIEW: Main dashboard ────────────────────────────────────
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div className="section-header" style={{ marginBottom: 0 }}>
          Dashboard
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>Robotics Lab</div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          background: "#111118",
          borderRadius: 8,
          padding: 4,
          marginBottom: 16,
          border: "1px solid #222230",
        }}
      >
        {[
          { id: "updates", label: "📤 Updates" },
          {
            id: "procurement",
            label: "📦 Procurement",
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              flex: 1,
              padding: "8px 4px",
              borderRadius: 6,
              border: "none",
              background: view === tab.id ? "#7c3aed" : "none",
              color: view === tab.id ? "#fff" : "#666",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">
          <div className="empty-icon">⏳</div>
          <div className="empty-text">Loading...</div>
        </div>
      ) : (
        <>
          {/* ── Updates tab — one card per student ── */}
          {view === "updates" && (
            <div>
              {STUDENTS.map((student) => {
                const studentUpdates = allUpdates.filter(
                  (u) => u.user_id === student.id,
                );
                const lastUpdate = studentUpdates[0];
                const pendingCount = procurementUpdates.filter(
                  (u) => u.user_id === student.id,
                ).length;
                const daysSince = lastUpdate
                  ? Math.floor(
                      (Date.now() - new Date(lastUpdate.created_at).getTime()) /
                        86400000,
                    )
                  : null;
                const isActive = daysSince !== null && daysSince <= 7;

                return (
                  <div
                    key={student.id}
                    className="card"
                    onClick={() => setSelectedStudent(student)}
                    style={{ cursor: "pointer" }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: isActive
                            ? "rgba(124,58,237,0.2)"
                            : "#1a1a24",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                          flexShrink: 0,
                        }}
                      >
                        👤
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#fff",
                          }}
                        >
                          {student.name}
                        </div>

                        {lastUpdate ? (
                          <>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#a78bfa",
                                marginTop: 2,
                              }}
                            >
                              {lastUpdate.title}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "#666",
                                marginTop: 3,
                                lineHeight: 1.4,
                                display: "-webkit-box",
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {lastUpdate.content}
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#444",
                              marginTop: 2,
                            }}
                          >
                            No updates yet
                          </div>
                        )}

                        {/* Meta */}
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            marginTop: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          {lastUpdate && (
                            <span style={{ fontSize: 11, color: "#555" }}>
                              {timeAgo(lastUpdate.created_at)}
                            </span>
                          )}
                          {studentUpdates.length > 0 && (
                            <span
                              style={{
                                fontSize: 10,
                                background: "#1a1a24",
                                border: "1px solid #333",
                                color: "#666",
                                padding: "1px 6px",
                                borderRadius: 8,
                              }}
                            >
                              {studentUpdates.length} update
                              {studentUpdates.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span
                              style={{
                                fontSize: 10,
                                background: "rgba(245,158,11,0.1)",
                                border: "1px solid rgba(245,158,11,0.2)",
                                color: "#f59e0b",
                                padding: "1px 6px",
                                borderRadius: 8,
                              }}
                            >
                              {pendingCount} procurement pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Active dot */}
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: isActive ? "#22c55e" : "#333",
                          flexShrink: 0,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Procurement tab — pending approval items ── */}

          {view === "procurement" &&
            (procurementUpdates.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📦</div>

                <div className="empty-text">No procurement updates</div>
              </div>
            ) : (
              procurementUpdates.map((update) => (
                <div key={update.id} className="card">
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 6,
                      color: "#fff",
                    }}
                  >
                    {update.title}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "#666",
                      marginBottom: 12,
                    }}
                  >
                    {update.user_name}
                    {" · "}
                    {timeAgo(update.created_at)}
                  </div>

                  {update.procurement_items?.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid #222",
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          style={{
                            width: "100%",
                            borderRadius: 8,
                            marginBottom: 10,
                            maxHeight: 180,
                            objectFit: "contain",
                            background: "#000",
                          }}
                        />
                      )}

                      <div
                        style={{
                          fontWeight: 700,
                          color: "#fff",
                          marginBottom: 6,
                        }}
                      >
                        {item.title}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          color: "#aaa",
                          marginBottom: 4,
                        }}
                      >
                        Vendor: {item.vendor || "N/A"}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          color: "#f59e0b",
                          marginBottom: 4,
                        }}
                      >
                        Price: {item.price || "N/A"}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          color: "#aaa",
                        }}
                      >
                        Purpose: {item.note || "N/A"}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ))}
        </>
      )}
    </div>
  );
}
