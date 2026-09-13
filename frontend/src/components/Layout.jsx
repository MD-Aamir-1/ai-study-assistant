import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "./Layout.css";

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {mobileOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="app-main">
        <Topbar onMenuClick={() => setMobileOpen((o) => !o)} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}