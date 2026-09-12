import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  CalendarCheck,
  HelpCircle,
  BarChart3,
  Bot,
  Settings,
  GraduationCap,
  Target,
  Sparkles,
} from "lucide-react";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/study-plan", label: "Study Plan", icon: CalendarCheck },
  { to: "/quiz", label: "Test", icon: HelpCircle },
  { to: "/progress", label: "Progress", icon: BarChart3 },
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