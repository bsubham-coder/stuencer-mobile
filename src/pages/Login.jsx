import { useState } from "react";
import { STUDENTS, PROFESSORS } from "../lib/constants";

export default function Login({ onLogin }) {
  const [selected, setSelected] = useState(null);

  const UserButton = ({ user }) => (
    <button
      onClick={() => setSelected(user)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "14px 16px",
        marginBottom: 8,
        borderRadius: 12,
        border:
          selected?.id === user.id
            ? "1.5px solid #7c3aed"
            : "1.5px solid #222230",
        background:
          selected?.id === user.id ? "rgba(124,58,237,0.1)" : "#111118",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: user.role === "professor" ? "#1a2030" : "#1a1a30",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {user.role === "professor" ? "👨‍🏫" : "👤"}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: selected?.id === user.id ? "#fff" : "#ccc",
          }}
        >
          {user.name}
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
          {user.role === "professor" ? "Professor · Robotics Lab" : "Student"}
        </div>
      </div>
      {selected?.id === user.id && (
        <span style={{ color: "#7c3aed", fontSize: 18 }}>✓</span>
      )}
    </button>
  );

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
        {/* Students */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#555",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          Students
        </div>
        {STUDENTS.map((s) => (
          <UserButton key={s.id} user={s} />
        ))}

        {/* Professor */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#555",
            textTransform: "uppercase",
            letterSpacing: 1,
            margin: "16px 0 8px",
          }}
        >
          Professor
        </div>
        {PROFESSORS.map((p) => (
          <UserButton key={p.id} user={p} />
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
