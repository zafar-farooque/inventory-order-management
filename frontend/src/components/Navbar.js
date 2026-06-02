import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard', icon: '📊' },
  { to: '/products',  label: 'Products',  icon: '📦' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/orders',    label: 'Orders',    icon: '🛒' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand" onClick={() => setOpen(false)}>
          <div className="brand-icon">🏪</div>
          <div className="brand-name">
            <span>InvenTrack</span>
            <span className="brand-sub">Inventory &amp; Orders</span>
          </div>
        </NavLink>

        <button
          className="navbar-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle navigation"
        >
          {open ? '✕' : '☰'}
        </button>

        <ul className={`navbar-links${open ? ' open' : ''}`}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="nav-icon">{icon}</span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
