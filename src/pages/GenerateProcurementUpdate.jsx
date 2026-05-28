import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function GenerateProcurementUpdate({ student }) {
  const [projects, setProjects] = useState([]);

  const [selectedProject, setSelectedProject] = useState(null);

  const [products, setProducts] = useState([]);

  const [isSending, setIsSending] = useState(false);

  const [sent, setSent] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", student.id)
      .order("created_at", { ascending: false });

    setProjects(data || []);
  };

  const loadProducts = async (projectId) => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", student.id)
      .order("timestamp", { ascending: false });

    setProducts(data || []);
  };

  const handleSelectProject = async (project) => {
    setSelectedProject(project);

    await loadProducts(project.id);

    setSent(false);
  };

  const handleSend = async () => {
    if (products.length === 0) {
      alert("No procurement items found.");

      return;
    }

    setIsSending(true);

    const procurementItems = products.map((p) => ({
      title: p.title || p.name,

      price: p.price || "",

      vendor: p.site || "",

      image: p.image || "",

      note: p.note || "",

      stage: p.stage || "",

      timestamp: p.timestamp,
    }));

    const { error } = await supabase.from("updates").insert({
      id: generateId(),

      project_id: selectedProject.id,

      user_id: student.id,

      user_name: student.name,

      title: `Procurement Update — ${selectedProject.name}`,

      content: `Procurement update containing ${products.length} items.`,

      update_type: "procurement",

      procurement_items: procurementItems,

      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(error);

      alert("Failed to send procurement update.");

      setIsSending(false);

      return;
    }

    setSent(true);

    setIsSending(false);
  };

  return (
    <div>
      <div className="section-header">Procurement Update</div>

      {/* PROJECTS */}

      <div className="card">
        <div className="label">Select Project</div>

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
              className="btn btn-ghost"
              onClick={() => handleSelectProject(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* PRODUCTS */}

      {selectedProject && (
        <div className="card">
          <div className="label">Procurement Items</div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 12,
            }}
          >
            {products.map((p, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                {p.image && (
                  <img
                    src={p.image}
                    alt=""
                    style={{
                      width: "100%",
                      borderRadius: 8,
                      marginBottom: 10,
                    }}
                  />
                )}

                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  {p.title}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    color: "#aaa",
                    marginBottom: 4,
                  }}
                >
                  Vendor: {p.site || "N/A"}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    color: "#aaa",
                    marginBottom: 4,
                  }}
                >
                  Price: {p.price || "N/A"}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    color: "#aaa",
                  }}
                >
                  Purpose: {p.note || "N/A"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEND */}

      {selectedProject && products.length > 0 && (
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={isSending}
        >
          {isSending ? "Sending..." : "📤 Send Procurement Update"}
        </button>
      )}

      {/* SUCCESS */}

      {sent && (
        <div
          className="card"
          style={{
            marginTop: 16,
            textAlign: "center",
          }}
        >
          ✅ Procurement update sent successfully.
        </div>
      )}
    </div>
  );
}
