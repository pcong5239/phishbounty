import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="card stack">
      <h1>Page not found</h1>
      <p className="lead">
        The page you are looking for does not exist or has been moved.
      </p>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <Link to="/">Go to Overview</Link>
        <Link to="/reports">View Reports</Link>
      </div>
    </div>
  );
}
