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
  X,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import "./Topbar.css";

export default function Topbar({ onMenuClick }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  const initial = user?.name?.charAt(0)?.toUpperCase() || "U";

  // Close user menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-focus when search opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [searchOpen]);

  // Escape closes search
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const handleSearchKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
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

      {/* ---------- EXPANDABLE SEARCH ---------- */}
      <div
        className={`topbar-search ${searchOpen ? "open" : ""}`}
        ref={searchRef}
      >
        {!searchOpen ? (
          <button
            className="topbar-search-trigger"
            onClick={() => setSearchOpen(true)}
            aria-label="Open search"
            title="Search"
          >
            <Search size={18} />
          </button>
        ) : (
          <form className="topbar-search-box" onSubmit={handleSubmit}>
            <Search size={16} className="topbar-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search any topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKey}
            />
            <button
              type="button"
              className="topbar-search-close"
              onClick={() => {
                setSearchQuery("");
                setSearchOpen(false);
              }}
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </form>
        )}
      </div>

      {/* ---------- RIGHT ACTIONS ---------- */}
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
              <button
                className="user-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/settings");
                }}
              >
                <User size={15} />
                Profile
              </button>
              <button
                className="user-menu-item danger"
                onClick={handleLogout}
              >
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