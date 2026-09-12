import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getStudents,
  updateStudent,
  deleteStudent,
  exportStudentData,
} from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  User as UserIcon,
  Palette,
  Clock,
  Bell,
  Download,
  AlertTriangle,
  Check,
  Sun,
  Moon,
  Save,
} from "lucide-react";
import "./Settings.css";

export default function Settings() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [profile, setProfile] = useState({ name: "", email: "", course: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Study preferences (local only)
  const [dailyMinutes, setDailyMinutes] = useState(
    () => Number(localStorage.getItem("pref_daily_minutes")) || 120
  );
  const [reminderTime, setReminderTime] = useState(
    () => localStorage.getItem("pref_reminder_time") || "18:00"
  );

  // Notification toggles (local only)
  const [notifDaily, setNotifDaily] = useState(
    () => localStorage.getItem("notif_daily") !== "false"
  );
  const [notifStreak, setNotifStreak] = useState(
    () => localStorage.getItem("notif_streak") !== "false"
  );
  const [notifQuiz, setNotifQuiz] = useState(
    () => localStorage.getItem("notif_quiz") !== "false"
  );

  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Load students
  useEffect(() => {
    getStudents()
      .then((res) => {
        setStudents(res.data);
        if (res.data.length > 0) {
          const first = res.data[0];
          setSelectedId(first.id);
          setProfile({
            name: first.name,
            email: first.email,
            course: first.course,
          });
        }
      })
      .catch(() => setError("Could not load students."));
  }, []);

  // Update profile form when student changes
  useEffect(() => {
    if (!selectedId) return;
    const s = students.find((x) => x.id === selectedId);
    if (s) setProfile({ name: s.name, email: s.email, course: s.course });
  }, [selectedId, students]);

  // Persist local preferences
  useEffect(() => {
    localStorage.setItem("pref_daily_minutes", dailyMinutes);
  }, [dailyMinutes]);
  useEffect(() => {
    localStorage.setItem("pref_reminder_time", reminderTime);
  }, [reminderTime]);
  useEffect(() => {
    localStorage.setItem("notif_daily", notifDaily);
  }, [notifDaily]);
  useEffect(() => {
    localStorage.setItem("notif_streak", notifStreak);
  }, [notifStreak]);
  useEffect(() => {
    localStorage.setItem("notif_quiz", notifQuiz);
  }, [notifQuiz]);

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
    if (!profile.name.trim() || !profile.email.trim() || !profile.course.trim()) {
      flash("All fields are required.", true);
      return;
    }
    setSaving(true);
    try {
      const res = await updateStudent(selectedId, profile);
      setStudents((prev) =>
        prev.map((s) => (s.id === selectedId ? res.data : s))
      );
      flash("Profile updated successfully!");
    } catch (err) {
      flash(err.response?.data?.detail || "Failed to save profile", true);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportStudentData(selectedId);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `study-assistant-export-${selectedId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash("Data exported successfully!");
    } catch {
      flash("Export failed.", true);
    }
  };

  const handleClearPrefs = () => {
    if (!window.confirm("Reset all local preferences?")) return;
    localStorage.removeItem("pref_daily_minutes");
    localStorage.removeItem("pref_reminder_time");
    localStorage.removeItem("notif_daily");
    localStorage.removeItem("notif_streak");
    localStorage.removeItem("notif_quiz");
    setDailyMinutes(120);
    setReminderTime("18:00");
    setNotifDaily(true);
    setNotifStreak(true);
    setNotifQuiz(true);
    flash("Preferences reset to defaults.");
  };

  const handleDeleteAccount = async () => {
    const confirmText = window.prompt(
      `Type DELETE to permanently remove "${profile.name}" and all associated data:`
    );
    if (confirmText !== "DELETE") {
      flash("Delete cancelled.", true);
      return;
    }
    try {
      await deleteStudent(selectedId);
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
      {/* ---------- HEADER ---------- */}
      <div className="settings-header">
        <div>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">
            Manage your profile, preferences, and data.
          </p>
        </div>

        <select
          value={selectedId || ""}
          onChange={(e) => setSelectedId(Number(e.target.value))}
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.course})
            </option>
          ))}
        </select>
      </div>

      {/* Flash messages */}
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

      {/* ---------- PROFILE ---------- */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-blue">
            <UserIcon size={18} />
          </div>
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
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
              />
            </label>
          </div>

          <label>
            <span>Course</span>
            <input
              type="text"
              value={profile.course}
              onChange={(e) =>
                setProfile({ ...profile, course: e.target.value })
              }
            />
          </label>

          <button type="submit" className="btn-save" disabled={saving}>
            <Save size={15} />
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

      {/* ---------- APPEARANCE ---------- */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-purple">
            <Palette size={18} />
          </div>
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
            <Sun size={18} />
            <span>Light</span>
          </button>
          <button
            className={`theme-option ${theme === "dark" ? "active" : ""}`}
            onClick={() => setTheme("dark")}
          >
            <Moon size={18} />
            <span>Dark</span>
          </button>
        </div>
      </section>

      {/* ---------- STUDY PREFERENCES ---------- */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-green">
            <Clock size={18} />
          </div>
          <div>
            <h2 className="section-title">Study Preferences</h2>
            <p className="section-desc">
              Defaults used when generating your study plan.
            </p>
          </div>
        </div>

        <div className="form-row">
          <label>
            <span>Daily Study Minutes</span>
            <input
              type="number"
              min="30"
              max="600"
              step="15"
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(Number(e.target.value))}
            />
          </label>

          <label>
            <span>Reminder Time</span>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* ---------- NOTIFICATIONS ---------- */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-orange">
            <Bell size={18} />
          </div>
          <div>
            <h2 className="section-title">Notifications</h2>
            <p className="section-desc">Choose what you want to be notified about.</p>
          </div>
        </div>

        <div className="toggle-list">
          <ToggleRow
            label="Daily Plan Reminder"
            desc="Remind me to study every day"
            checked={notifDaily}
            onChange={setNotifDaily}
          />
          <ToggleRow
            label="Streak Alerts"
            desc="Notify me when my streak is at risk"
            checked={notifStreak}
            onChange={setNotifStreak}
          />
          <ToggleRow
            label="Quiz Results"
            desc="Show a summary after each quiz"
            checked={notifQuiz}
            onChange={setNotifQuiz}
          />
        </div>
      </section>

      {/* ---------- DATA & PRIVACY ---------- */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-blue">
            <Download size={18} />
          </div>
          <div>
            <h2 className="section-title">Data & Privacy</h2>
            <p className="section-desc">Your data, your control.</p>
          </div>
        </div>

        <div className="data-actions">
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={15} /> Export All Data (JSON)
          </button>
          <button className="btn-secondary" onClick={handleClearPrefs}>
            Reset Local Preferences
          </button>
        </div>
      </section>

      {/* ---------- DANGER ZONE ---------- */}
      <section className="settings-section danger-zone">
        <div className="section-head">
          <div className="section-icon icon-red">
            <AlertTriangle size={18} />
          </div>
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

/* ---------- Helper: Toggle Row ---------- */
function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        <div className="toggle-desc">{desc}</div>
      </div>
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}