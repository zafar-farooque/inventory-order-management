import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

/* ─── Stat Card ─────────────────────────────────────────────────────────── */
function StatCard({ icon, value, label, accent }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value" style={{ color: accent }}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ─── Low-Stock row ─────────────────────────────────────────────────────── */
function LowStockRow({ product }) {
  const badgeClass =
    product.quantity === 0 ? 'badge-cancelled' :
    product.quantity < 5  ? 'badge-pending'   : 'badge-confirmed';

  const label =
    product.quantity === 0 ? '⛔ Out of stock' : `⚠ ${product.quantity} left`;

  return (
    <tr>
      <td style={{ fontWeight: 500 }}>{product.name}</td>
      <td><span className="chip">{product.sku}</span></td>
      <td style={{ textAlign: 'right' }}>
        <span className={`badge ${badgeClass}`}>{label}</span>
      </td>
    </tr>
  );
}

/* ─── Dashboard ─────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setError('');
    api.get('/api/v1/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  /* ── Loading ── */
  if (loading) return (
    <div className="state-container">
      <div className="spinner" />
      <span>Loading dashboard…</span>
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div className="state-container">
      <div className="state-icon">⚠️</div>
      <div className="state-title">Failed to load dashboard</div>
      <div className="state-sub">{error}</div>
      <button className="btn btn-ghost" onClick={fetchDashboard} style={{ marginTop: 8 }}>
        ↺ Retry
      </button>
    </div>
  );

  const lowCount = data.low_stock_products.length;

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1>📊 Dashboard</h1>
          <p className="page-subtitle">Real-time overview of your inventory &amp; orders</p>
        </div>
        <button className="btn btn-ghost" onClick={fetchDashboard}>↺ Refresh</button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-xl)' }}>
        <StatCard
          icon="📦"
          value={data.total_products}
          label="Total Products"
          accent="var(--color-primary)"
        />
        <StatCard
          icon="👥"
          value={data.total_customers}
          label="Total Customers"
          accent="var(--color-info)"
        />
        <StatCard
          icon="🛒"
          value={data.total_orders}
          label="Total Orders"
          accent="var(--color-success)"
        />
        <StatCard
          icon={lowCount > 0 ? '🚨' : '✅'}
          value={lowCount}
          label="Low Stock Alerts"
          accent={lowCount > 0 ? 'var(--color-warning)' : 'var(--color-success)'}
        />
      </div>

      {/* ── Low-stock table ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-md)' }}>
          <h3>🚨 Low Stock Alerts</h3>
          <span className="badge badge-warning">qty &lt; 10</span>
        </div>

        {lowCount === 0 ? (
          <div className="state-container" style={{ padding: 'var(--space-xl)' }}>
            <div className="state-icon">✅</div>
            <div className="state-title">All products well stocked</div>
            <div className="state-sub">No products below the threshold of 10 units</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th style={{ textAlign: 'right' }}>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {data.low_stock_products.map((p) => (
                  <LowStockRow key={p.id} product={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
