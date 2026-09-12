import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateStudent, deleteStudent, exportStudentData } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  User as UserIcon, Palette, Download, AlertTriangle, Check,
  Sun, Moon, Save,
} from "lucide-react";
import "./Settings.css";

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: "", email: "", course: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || "",
        email: user.email || "",
        course: user.course || "",
      });
    }
  }, [user]);

  const flash = (msg, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => {
      setError("");
      setSuccess("");
    }, 2500);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user?.student_id) return;
    if (!profile.name.trim() || !profile.email.trim() || !profile.course.trim()) {
      flash("All fields are required.", true);
      return;
    }
    setSaving(true);
    try {
      await updateStudent(user.student_id, profile);
      // Update local storage so name/email reflect immediately
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({ ...stored, ...profile })
      );
      flash("Profile updated successfully!");
    } catch (err) {
      flash(err.response?.data?.detail || "Failed to save profile", true);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!user?.student_id) return;
    try {
      const res = await exportStudentData(user.student_id);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `study-assistant-export-${user.student_id}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash("Data exported successfully!");
    } catch {
      flash("Export failed.", true);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.student_id) return;
    const confirmText = window.prompt(
      `Type DELETE to permanently remove "${profile.name}" and all associated data:`
    );
    if (confirmText !== "DELETE") {
      flash("Delete cancelled.", true);
      return;
    }
    try {
      await deleteStudent(user.student_id);
      flash("Account deleted. Logging out...");
      setTimeout(() => {
        logout();
        navigate("/login");
      }, 1500);
    } catch {
      flash("Failed to delete account.", true);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">
            Manage your profile, preferences, and data.
          </p>
        </div>
      </div>

      {error && (
        <div className="settings-flash settings-flash-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="settings-flash settings-flash-success">
          <Check size={16} /> {success}
        </div>
      )}

      {/* PROFILE */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-blue"><UserIcon size={18} /></div>
          <div>
            <h2 className="section-title">Profile</h2>
            <p className="section-desc">Your personal information.</p>
          </div>
        </div>

        <form className="settings-form" onSubmit={handleSaveProfile}>
          <div className="form-row">
            <label>
              <span>Name</span>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </label>
          </div>
          <label>
            <span>Course</span>
            <input
              type="text"
              value={profile.course}
              onChange={(e) => setProfile({ ...profile, course: e.target.value })}
            />
          </label>
          <button type="submit" className="btn-save" disabled={saving}>
            <Save size={15} /> {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

      {/* APPEARANCE */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-purple"><Palette size={18} /></div>
          <div>
            <h2 className="section-title">Appearance</h2>
            <p className="section-desc">Choose how the app looks.</p>
          </div>
        </div>
        <div className="theme-options">
          <button
            className={`theme-option ${theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}
          >
            <Sun size={18} /><span>Light</span>
          </button>
          <button
            className={`theme-option ${theme === "dark" ? "active" : ""}`}
            onClick={() => setTheme("dark")}
          >
            <Moon size={18} /><span>Dark</span>
          </button>
        </div>
      </section>

      {/* DATA */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-blue"><Download size={18} /></div>
          <div>
            <h2 className="section-title">Data & Privacy</h2>
            <p className="section-desc">Your data, your control.</p>
          </div>
        </div>
        <div className="data-actions">
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={15} /> Export All Data (JSON)
          </button>
        </div>
      </section>

      {/* DANGER */}
      <section className="settings-section danger-zone">
        <div className="section-head">
          <div className="section-icon icon-red"><AlertTriangle size={18} /></div>
          <div>
            <h2 className="section-title">Danger Zone</h2>
            <p className="section-desc">
              This action cannot be undone. All subjects, topics, quizzes and
              progress will be deleted.
            </p>
          </div>
        </div>
        <button className="btn-danger" onClick={handleDeleteAccount}>
          Delete Account & All Data
        </button>
      </section>
    </div>
  );
}