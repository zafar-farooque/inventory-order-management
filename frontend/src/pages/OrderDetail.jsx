import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

function StatusBadge({ status }) {
  const icons = { pending:'🕐', confirmed:'✅', shipped:'🚚', delivered:'📬', cancelled:'❌' };
  return <span className={`badge badge-${status}`}>{icons[status] ?? '•'} {status}</span>;
}

function InfoBlock({ label, children }) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children}</div>
    </div>
  );
}

export default function OrderDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get(`/api/v1/orders/${id}`)
      .then((res) => setOrder(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    const confirmed = window.confirm(
      `Cancel Order #${id}?\n\nAll stock will be restored. This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`/api/v1/orders/${id}`);
      navigate('/orders', { replace: true });
    } catch (err) {
      setError(`Failed to cancel order: ${err.message}`);
    }
  };

  /* ── Loading state ── */
  if (loading) return (
    <div className="state-container">
      <div className="spinner" /><span>Loading order details…</span>
    </div>
  );

  /* ── Error state ── */
  if (error) return (
    <div className="state-container">
      <div className="state-icon">⚠️</div>
      <div className="state-title">Could not load order</div>
      <div className="state-sub">{error}</div>
      <Link to="/orders" className="btn btn-ghost" style={{ marginTop: 8 }}>← Back to Orders</Link>
    </div>
  );

  if (!order) return null;

  const items       = order.order_items ?? [];
  const placedDate  = new Date(order.created_at);

  /* Per-item subtotal — backend provides line_total when available */
  const lineTotal = (item) =>
    parseFloat(item.line_total ?? item.unit_price * item.quantity);

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1>🧾 Order #{String(order.id).padStart(4, '0')}</h1>
          <p className="page-subtitle">
            Placed on{' '}
            {placedDate.toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <Link to="/orders" className="btn btn-ghost">← Back</Link>
          <button className="btn btn-danger" onClick={handleCancel}>🚫 Cancel Order</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>⚠️ {error}</div>}

      {/* ── Top cards: Order info + Customer info ── */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>

        {/* Order info card */}
        <div className="card">
          <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
            Order Information
          </h3>
          <div className="detail-grid">
            <InfoBlock label="Order ID">
              <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                #{String(order.id).padStart(4, '0')}
              </span>
            </InfoBlock>
            <InfoBlock label="Status"><StatusBadge status={order.status} /></InfoBlock>
            <InfoBlock label="Total Amount">
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-success)' }}>
                ${parseFloat(order.total_amount).toFixed(2)}
              </span>
            </InfoBlock>
            <InfoBlock label="Line Items">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </InfoBlock>
            <InfoBlock label="Date Placed">
              {placedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </InfoBlock>
            <InfoBlock label="Time">
              {placedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </InfoBlock>
          </div>
        </div>

        {/* Customer info card */}
        <div className="card">
          <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
            Customer
          </h3>
          {order.customer ? (
            <div className="detail-grid">
              <InfoBlock label="Name">
                <span style={{ fontWeight: 600 }}>{order.customer.name}</span>
              </InfoBlock>
              <InfoBlock label="Email">
                <a href={`mailto:${order.customer.email}`} style={{ color: 'var(--color-info)' }}>
                  {order.customer.email}
                </a>
              </InfoBlock>
              <InfoBlock label="Phone">
                {order.customer.phone
                  ? <a href={`tel:${order.customer.phone}`} style={{ color: 'var(--color-text)' }}>{order.customer.phone}</a>
                  : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
              </InfoBlock>
              <InfoBlock label="Customer ID">#{order.customer_id}</InfoBlock>
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)' }}>Customer #{order.customer_id}</p>
          )}
        </div>
      </div>

      {/* ── Line items table ── */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 'var(--space-lg)' }}>
          <h3>Order Items</h3>
        </div>
        <div className="table-wrapper" style={{ border: 'none', borderTop: '1px solid var(--color-border)' }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Product ID</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th style={{ textAlign: 'right' }}>Quantity</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                    No items in this order.
                  </td>
                </tr>
              ) : (
                items.map((item, i) => (
                  <tr key={item.id}>
                    <td className="td-muted">{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>
                      {item.product_name ?? `Product #${item.product_id}`}
                    </td>
                    <td><span className="chip">#{item.product_id}</span></td>
                    <td style={{ textAlign: 'right' }}>${parseFloat(item.unit_price).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>× {item.quantity}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>
                      ${lineTotal(item).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Grand total footer row */}
            <tfoot>
              <tr style={{ background: 'var(--color-surface-2)', borderTop: '2px solid var(--color-border)' }}>
                <td colSpan={5} style={{ padding: 'var(--space-md) var(--space-lg)', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                  Grand Total
                </td>
                <td style={{ padding: 'var(--space-md) var(--space-lg)', textAlign: 'right', fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-success)' }}>
                  ${parseFloat(order.total_amount).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
