import { useState } from "react";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Session from "./pages/Session";
import Timeline from "./pages/Timeline";
import GenerateUpdate from "./pages/GenerateUpdate";
import GenerateProcurementUpdate from "./pages/GenerateProcurementUpdate";
import ProfessorDashboard from "./pages/ProfessorDashboard";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [page, setPage] = useState("home");
  const [activeProject, setActiveProject] = useState(null);
  const [activeStage, setActiveStage] = useState(null);

  const handleLogin = (selectedUser) => {
    setUser(selectedUser);
    localStorage.setItem("user", JSON.stringify(selectedUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
    setPage("home");
    setActiveProject(null);
    setActiveStage(null);
  };

  const handleStartSession = (project, stage) => {
    setActiveProject(project);
    setActiveStage(stage);
    setPage("session");
  };

  const handleStopSession = () => {
    setActiveProject(null);
    setActiveStage(null);
    setPage("home");
  };

  if (!user) return <Login onLogin={handleLogin} />;

  // ── PROFESSOR VIEW ──────────────────────────────────────────
  if (user.role === "professor") {
    return (
      <div className="app">
        <div className="topbar">
          <div className="topbar-left">
            <span className="topbar-logo">⚡</span>
            <span className="topbar-name">Stuencer</span>
          </div>
          <div className="topbar-right">
            <span className="student-badge">Prof. View</span>
            <button className="logout-btn" onClick={handleLogout}>
              Switch
            </button>
          </div>
        </div>
        <div className="page-content" style={{ paddingBottom: 24 }}>
          <ProfessorDashboard professor={user} />
        </div>
      </div>
    );
  }

  // ── STUDENT VIEW ────────────────────────────────────────────
  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">⚡</span>
          <span className="topbar-name">Stuencer</span>
        </div>
        <div className="topbar-right">
          <span className="student-badge">{user.name.split(" ")[0]}</span>
          <button className="logout-btn" onClick={handleLogout}>
            Switch
          </button>
        </div>
      </div>

      {page !== "session" && (
        <div className="bottom-nav">
          <button
            className={`nav-btn ${page === "home" ? "active" : ""}`}
            onClick={() => setPage("home")}
          >
            🏠 Home
          </button>
          <button
            className={`nav-btn ${page === "timeline" ? "active" : ""}`}
            onClick={() => setPage("timeline")}
          >
            📋 Timeline
          </button>
          <button
            className={`nav-btn ${page === "update" ? "active" : ""}`}
            onClick={() => setPage("update")}
          >
            📤 Progress
          </button>

          <button
            className={`nav-btn ${page === "procurement" ? "active" : ""}`}
            onClick={() => setPage("procurement")}
          >
            📦 Procurement
          </button>
        </div>
      )}

      <div className="page-content">
        {page === "home" && (
          <Home student={user} onStartSession={handleStartSession} />
        )}
        {page === "session" && (
          <Session
            student={user}
            project={activeProject}
            stage={activeStage}
            onStop={handleStopSession}
          />
        )}
        {page === "timeline" && <Timeline student={user} />}
        {page === "update" && <GenerateUpdate student={user} />}

        {page === "procurement" && <GenerateProcurementUpdate student={user} />}
      </div>
    </div>
  );
}
