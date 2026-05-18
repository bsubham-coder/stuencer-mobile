import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { STAGES } from "../lib/constants";

export default function Home({ student, onStartSession }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);

  useEffect(() => {
    loadProjects();
  }, [student]);

  const loadProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", student.id)
      .order("created_at", { ascending: false });

    if (!error) setProjects(data || []);
    setLoading(false);
  };

  const handleStart = () => {
    if (!selectedProject || !selectedStage) return;
    onStartSession(selectedProject, selectedStage);
  };

  if (loading) {
    return (
      <div className="empty">
        <div className="empty-icon">⏳</div>
        <div className="empty-text">Loading projects...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">Start Capturing</div>

      {/* Project selection */}
      <div className="card">
        <div className="label">Select Project</div>
        {projects.length === 0 ? (
          <div style={{ color: "#666", fontSize: 13, padding: "8px 0" }}>
            No projects yet. Create one on the desktop app first.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 8,
            }}
          >
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  border:
                    selectedProject?.id === p.id
                      ? "1.5px solid #7c3aed"
                      : "1.5px solid #333",
                  background:
                    selectedProject?.id === p.id
                      ? "rgba(124,58,237,0.1)"
                      : "#1a1a24",
                  color: selectedProject?.id === p.id ? "#fff" : "#ccc",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stage selection */}
      {selectedProject && (
        <div className="card">
          <div className="label">Select Stage</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 8,
            }}
          >
            {STAGES.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setSelectedStage(stage)}
                style={{
                  padding: "14px 10px",
                  borderRadius: 8,
                  border:
                    selectedStage?.id === stage.id
                      ? "1.5px solid #7c3aed"
                      : "1.5px solid #333",
                  background:
                    selectedStage?.id === stage.id
                      ? "rgba(124,58,237,0.1)"
                      : "#1a1a24",
                  color: selectedStage?.id === stage.id ? "#fff" : "#ccc",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>
                  {stage.emoji}
                </div>
                {stage.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Start button */}
      {selectedProject && selectedStage && (
        <button className="btn btn-primary" onClick={handleStart}>
          Start {selectedStage.name} Session →
        </button>
      )}
    </div>
  );
}
