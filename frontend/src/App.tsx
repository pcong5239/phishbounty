import { NavLink, Route, Routes } from "react-router-dom";
import Overview from "./pages/Overview";
import Brands from "./pages/Brands";
import BrandDetail from "./pages/BrandDetail";
import Reports from "./pages/Reports";
import ReportDetail from "./pages/ReportDetail";
import Blocklist from "./pages/Blocklist";
import Hunters from "./pages/Hunters";
import Hunt from "./pages/Hunt";
import NotFound from "./pages/NotFound";
import { WalletBar } from "./components/WalletBar";
import { WalletChooser } from "./components/WalletChooser";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/hunt", label: "File a report", end: false },
  { to: "/brands", label: "Brands", end: false },
  { to: "/reports", label: "Reports", end: false },
  { to: "/blocklist", label: "Blocklist", end: false },
  { to: "/hunters", label: "Hunters", end: false },
];

export default function App() {
  return (
    <>
      <div className="layout" id="app-shell">
        <aside className="sidebar">
          <div className="brand">PhishBounty</div>
          <nav aria-label="Main navigation">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <WalletBar />
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/hunt" element={<Hunt />} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/brands/:id" element={<BrandDetail />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:id" element={<ReportDetail />} />
            <Route path="/blocklist" element={<Blocklist />} />
            <Route path="/hunters" element={<Hunters />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
      <WalletChooser />
    </>
  );
}
