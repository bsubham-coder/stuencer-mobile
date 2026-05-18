import { useState } from "react";
import { STUDENTS } from "../lib/constants";

export function Login({ onLogin }) {
  const [selected, setSelected] = useState(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#0a0a0f",
      }}
    >
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>
          Stuencer
        </div>
        <div style={{ fontSize: 14, color: "#666", marginTop: 6 }}>
          Robotics Lab · Who are you?
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 360 }}>
        {STUDENTS.map((student) => (
          <button
            key={student.id}
            onClick={() => setSelected(student)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "14px 16px",
              marginBottom: 8,
              borderRadius: 12,
              border:
                selected?.id === student.id
                  ? "1.5px solid #7c3aed"
                  : "1.5px solid #222230",
              background:
                selected?.id === student.id
                  ? "rgba(124,58,237,0.1)"
                  : "#111118",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "#1a1a30",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              👤
            </div>
            <span
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: 500,
                color: selected?.id === student.id ? "#fff" : "#ccc",
              }}
            >
              {student.name}
            </span>
            {selected?.id === student.id && (
              <span style={{ color: "#7c3aed", fontSize: 18 }}>✓</span>
            )}
          </button>
        ))}

        <button
          className="btn btn-primary"
          style={{ marginTop: 16 }}
          onClick={() => selected && onLogin(selected)}
          disabled={!selected}
        >
          Continue as {selected?.name || "..."}
        </button>
      </div>
    </div>
  );
}
