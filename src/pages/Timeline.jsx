import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Timeline({ student }) {
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCaptures();
  }, [student]);

  const loadCaptures = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("captures")
      .select("*")
      .eq("user_id", student.id)
      .order("timestamp", { ascending: false })
      .limit(50);

    if (!error) setCaptures(data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="empty">
        <div className="empty-icon">⏳</div>
        <div className="empty-text">Loading...</div>
      </div>
    );
  }

  if (captures.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">📋</div>
        <div className="empty-text">No captures yet</div>
        <div className="empty-sub">Start a session to capture your work</div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">Your Timeline</div>
      {captures.map((c) => (
        <div key={c.id} className="card">
          {/* Image or video */}
          {c.image_path &&
            (c.image_path.includes(".webm") ? (
              <video
                src={c.image_path}
                controls
                style={{ width: "100%", borderRadius: 8, marginBottom: 10 }}
              />
            ) : (
              <img
                src={c.image_path}
                alt=""
                style={{
                  width: "100%",
                  borderRadius: 8,
                  marginBottom: 10,
                  objectFit: "cover",
                  maxHeight: 200,
                }}
              />
            ))}

          {/* Content */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#a78bfa",
                background: "rgba(167,139,250,0.1)",
                padding: "2px 8px",
                borderRadius: 10,
              }}
            >
              {c.stage}
            </span>
            <span style={{ fontSize: 11, color: "#555" }}>
              {timeAgo(c.timestamp)}
            </span>
          </div>

          <div style={{ fontSize: 14, color: "#ddd", lineHeight: 1.5 }}>
            {c.text}
          </div>

          <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>
            {c.type} · {c.source === "mobile" ? "📱 Mobile" : "💻 Desktop"}
          </div>
        </div>
      ))}
    </div>
  );
}
