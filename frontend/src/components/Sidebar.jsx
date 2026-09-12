import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  HelpCircle,
  Target,
  Sparkles,
  Bot,
  Settings,
  GraduationCap,
} from "lucide-react";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/quiz", label: "Test", icon: HelpCircle },
  { to: "/gaps", label: "Knowledge Gaps", icon: Target },
  { to: "/recommendations", label: "Recommendations", icon: Sparkles },
  { to: "/ai-tutor", label: "AI Tutor", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <GraduationCap size={26} />
        <span>AI Study Assistant</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}