import { NavLink } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="brand">🎓 AI Study Assistant</div>
      <div className="links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>
        <NavLink to="/study-plan" className={({ isActive }) => (isActive ? "active" : "")}>
          Study Plan
        </NavLink>
        <NavLink to="/quiz" className={({ isActive }) => (isActive ? "active" : "")}>
          Quiz
        </NavLink>
        <NavLink to="/ai-tutor" className={({ isActive }) => (isActive ? "active" : "")}>
          AI Tutor
        </NavLink>
      </div>
    </nav>
  );
}