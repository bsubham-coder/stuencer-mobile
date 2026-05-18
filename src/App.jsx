import { useState, useEffect } from "react";
import { Login } from "./pages/Login";
import Home from "./pages/Home";
import Session from "./pages/Session";
import Timeline from "./pages/Timeline";
import "./App.css";

export default function App() {
  const [student, setStudent] = useState(() => {
    const saved = localStorage.getItem("student");
    return saved ? JSON.parse(saved) : null;
  });

  const [page, setPage] = useState("home");
  const [activeProject, setActiveProject] = useState(null);
  const [activeStage, setActiveStage] = useState(null);

  const handleLogin = (selectedStudent) => {
    setStudent(selectedStudent);
    localStorage.setItem("student", JSON.stringify(selectedStudent));
  };

  const handleLogout = () => {
    setStudent(null);
    localStorage.removeItem("student");
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

  if (!student) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">⚡</span>
          <span className="topbar-name">Stuencer</span>
        </div>
        <div className="topbar-right">
          <span className="student-badge">{student.name.split(" ")[0]}</span>
          <button className="logout-btn" onClick={handleLogout}>
            Switch
          </button>
        </div>
      </div>

      {/* Navigation */}
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
        </div>
      )}

      {/* Pages */}
      <div className="page-content">
        {page === "home" && (
          <Home student={student} onStartSession={handleStartSession} />
        )}
        {page === "session" && (
          <Session
            student={student}
            project={activeProject}
            stage={activeStage}
            onStop={handleStopSession}
          />
        )}
        {page === "timeline" && <Timeline student={student} />}
      </div>
    </div>
  );
}
