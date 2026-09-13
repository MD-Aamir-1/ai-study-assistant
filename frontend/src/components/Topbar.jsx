import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Sun,
  Moon,
  LogOut,
  User,
  Menu,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import "./Topbar.css";

export default function Topbar({ onMenuClick }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const initial = user?.name?.charAt(0)?.toUpperCase() || "U";

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="topbar">
      <button
        className="hamburger"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="search-wrap">
        <Search size={16} />
        <input placeholder="Search anything..." />
      </div>

      <div className="topbar-actions">
        <button className="icon-btn" onClick={toggle} title="Toggle theme">
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <button className="icon-btn" title="Notifications">
          <Bell size={18} />
          <span className="badge-dot" />
        </button>

        <div className="user-menu-wrap" ref={menuRef}>
          <div
            className="user-chip"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <div className="avatar">{initial}</div>
            <div className="user-meta">
              <div className="user-name">{user?.name || "Student"}</div>
              <div className="user-role">Student</div>
            </div>
          </div>

          {menuOpen && (
            <div className="user-menu">
              <div className="user-menu-header">
                <div className="user-menu-avatar">{initial}</div>
                <div>
                  <div className="user-menu-name">{user?.name}</div>
                  <div className="user-menu-email">{user?.email}</div>
                </div>
              </div>
              <button className="user-menu-item">
                <User size={15} />
                Profile
              </button>
              <button className="user-menu-item danger" onClick={handleLogout}>
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}