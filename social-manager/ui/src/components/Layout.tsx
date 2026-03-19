import { NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

export function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <h1>Social Manager</h1>
        </div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/accounts">Accounts</NavLink>
          <NavLink to="/proxies">Proxies</NavLink>
          <NavLink to="/actions">Actions</NavLink>
          <NavLink to="/jobs">Jobs</NavLink>
          <NavLink to="/identities">Identities</NavLink>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
