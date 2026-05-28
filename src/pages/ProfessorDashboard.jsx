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
  const [view, setView] = useState("updates");
  const [allUpdates, setAllUpdates] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Navigation state
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Comment state
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);

  // Procurement state
  const [approvalNote, setApprovalNote] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadUpdates(), loadPendingProducts()]);
    setLoading(false);
  };

  const loadUpdates = async () => {
    const { data } = await supabase
      .from("updates")
      .select("*")
      .eq("status", "sent")
      .order("created_at", { ascending: false });
    setAllUpdates(data || []);
  };

  const loadPendingProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("approval_status", "pending")
      .order("timestamp", { ascending: false });
    setPendingProducts(data || []);
  };

  const loadComments = async (updateId) => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("update_id", updateId)
      .order("created_at", { ascending: true });
    setComments(data || []);
  };

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

  const handleApprove = async (product) => {
    setIsApproving(true);
    await supabase
      .from("products")
      .update({
        approval_status: "approved",
        approval_note: approvalNote.trim() || "Approved",
        approved_by: professor.name,
        approved_at: Date.now(),
      })
      .eq("id", product.id);
    setApprovalNote("");
    setSelectedProduct(null);
    await loadPendingProducts();
    setIsApproving(false);
  };

  const handleReject = async (product) => {
    if (!approvalNote.trim()) {
      alert("Please add a reason for rejection.");
      return;
    }
    setIsApproving(true);
    await supabase
      .from("products")
      .update({
        approval_status: "rejected",
        approval_note: approvalNote.trim(),
        approved_by: professor.name,
        approved_at: Date.now(),
      })
      .eq("id", product.id);
    setApprovalNote("");
    setSelectedProduct(null);
    await loadPendingProducts();
    setIsApproving(false);
  };

  // ── Back button helper ─────────────────────────────────────

  const BackButton = ({ onClick, label = "← Back" }) => (
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
      {label}
    </button>
  );

  // ── Procurement detail ─────────────────────────────────────

  if (selectedProduct) {
    return (
      <div>
        <BackButton
          onClick={() => {
            setSelectedProduct(null);
            setApprovalNote("");
          }}
        />
        <div className="section-header">Procurement Request</div>

        <div className="card">
          {selectedProduct.image && (
            <img
              src={selectedProduct.image}
              alt=""
              style={{
                width: "100%",
                borderRadius: 8,
                marginBottom: 12,
                maxHeight: 200,
                objectFit: "contain",
                background: "#000",
              }}
            />
          )}
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 8,
            }}
          >
            {selectedProduct.title}
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#666" }}>Price</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f59e0b" }}>
                {selectedProduct.price || "N/A"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#666" }}>Vendor</div>
              <div style={{ fontSize: 14, color: "#ccc" }}>
                {selectedProduct.site?.replace("www.", "")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#666" }}>Stage</div>
              <div style={{ fontSize: 14, color: "#ccc" }}>
                {selectedProduct.stage}
              </div>
            </div>
          </div>
          {selectedProduct.note && (
            <div
              style={{
                background: "#1a1a24",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                Why student needs this:
              </div>
              <div style={{ fontSize: 13, color: "#ddd" }}>
                {selectedProduct.note}
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, color: "#666" }}>
            Requested by {selectedProduct.user_name} ·{" "}
            {timeAgo(selectedProduct.timestamp)}
          </div>
        </div>

        <div className="card">
          <div className="label">
            Note (optional for approve, required for reject)
          </div>
          <textarea
            className="input"
            rows={3}
            placeholder="e.g. Approved — check voltage rating."
            value={approvalNote}
            onChange={(e) => setApprovalNote(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-success"
            onClick={() => handleApprove(selectedProduct)}
            disabled={isApproving}
            style={{ flex: 1 }}
          >
            ✅ Approve
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleReject(selectedProduct)}
            disabled={isApproving || !approvalNote.trim()}
            style={{ flex: 1 }}
          >
            ❌ Reject
          </button>
        </div>
      </div>
    );
  }

  // ── Update detail view ─────────────────────────────────────

  if (selectedUpdate) {
    // Get all updates for this student to show below
    const studentUpdates = allUpdates
      .filter((u) => u.user_id === selectedUpdate.user_id)
      .filter((u) => u.id !== selectedUpdate.id);

    return (
      <div>
        <BackButton
          onClick={() => {
            setSelectedUpdate(null);
            setComments([]);
            setComment("");
          }}
        />

        {/* Update header */}
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

        {/* Update content */}
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
        {studentUpdates.length > 0 && (
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
            {studentUpdates.map((update) => (
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

  // ── Student updates list ───────────────────────────────────

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

  // ── Main dashboard ─────────────────────────────────────────

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

      {/* Tab bar — only Updates and Procurement */}
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
            label: `📦 Procurement${
              pendingProducts.length > 0 ? ` (${pendingProducts.length})` : ""
            }`,
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
          {/* Updates tab — student cards */}
          {view === "updates" && (
            <div>
              {STUDENTS.map((student) => {
                const studentUpdates = allUpdates.filter(
                  (u) => u.user_id === student.id,
                );
                const lastUpdate = studentUpdates[0];
                const pendingCount = pendingProducts.filter(
                  (p) => p.user_id === student.id,
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
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#fff",
                          }}
                        >
                          {student.name}
                        </div>

                        {/* Last update preview */}
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

                        {/* Meta row */}
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            marginTop: 6,
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

                      {/* Active indicator */}
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

          {/* Procurement tab */}
          {view === "procurement" &&
            (pendingProducts.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">✅</div>
                <div className="empty-text">All clear</div>
                <div className="empty-sub">No pending procurement requests</div>
              </div>
            ) : (
              pendingProducts.map((product) => (
                <div
                  key={product.id}
                  className="card"
                  onClick={() => setSelectedProduct(product)}
                  style={{ cursor: "pointer" }}
                >
                  <div style={{ display: "flex", gap: 12 }}>
                    {product.image ? (
                      <img
                        src={product.image}
                        alt=""
                        style={{
                          width: 64,
                          height: 64,
                          objectFit: "contain",
                          borderRadius: 8,
                          background: "#000",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 8,
                          background: "#1a1a24",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 24,
                          flexShrink: 0,
                        }}
                      >
                        📦
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#fff",
                          marginBottom: 4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {product.title}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#f59e0b",
                          marginBottom: 4,
                        }}
                      >
                        {product.price || "Price N/A"}
                      </div>
                      <div style={{ fontSize: 11, color: "#666" }}>
                        {product.user_name} ·{" "}
                        {product.site?.replace("www.", "")}
                      </div>
                    </div>
                  </div>
                  {product.note && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#888",
                        marginTop: 10,
                        padding: "8px 10px",
                        background: "#1a1a24",
                        borderRadius: 6,
                      }}
                    >
                      "{product.note}"
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        background: "rgba(245,158,11,0.1)",
                        color: "#f59e0b",
                        border: "1px solid rgba(245,158,11,0.2)",
                        padding: "2px 8px",
                        borderRadius: 10,
                      }}
                    >
                      ⏳ Pending approval
                    </span>
                    <span style={{ fontSize: 11, color: "#a78bfa" }}>
                      Tap to review →
                    </span>
                  </div>
                </div>
              ))
            ))}
        </>
      )}
    </div>
  );
}
