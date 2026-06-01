import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const selectStyle = {
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--color-text)',
  fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', width: '100%', cursor: 'pointer',
};
const inputStyle  = { ...selectStyle, cursor: 'text' };
const labelStyle  = {
  display: 'block', marginBottom: 6, fontSize: '0.78rem',
  color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500,
};

function StatusBadge({ status }) {
  const icons = { pending:'🕐', confirmed:'✅', shipped:'🚚', delivered:'📬', cancelled:'❌' };
  return <span className={`badge badge-${status}`}>{icons[status] ?? '•'} {status}</span>;
}

function OrderItemRow({ index, item, products, onChange, onRemove, canRemove }) {
  const selected = products.find((p) => p.id === Number(item.product_id));
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 'var(--space-sm)',
      alignItems: 'end', marginBottom: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)',
      background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
    }}>
      <div>
        {index === 0 && <label style={labelStyle}>Product</label>}
        <select style={selectStyle} value={item.product_id} onChange={(e) => onChange(index, 'product_id', e.target.value)} required>
          <option value="">— Select product —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id} disabled={p.quantity === 0}>
              {p.name} · ${parseFloat(p.price).toFixed(2)} · {p.quantity} in stock{p.quantity === 0 ? ' (out)' : ''}
            </option>
          ))}
        </select>
        {selected && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Unit price: <strong style={{ color: 'var(--color-text)' }}>${parseFloat(selected.price).toFixed(2)}</strong>
            {' '}· Stock: <strong style={{ color: selected.quantity < 10 ? 'var(--color-warning)' : 'var(--color-success)' }}>{selected.quantity}</strong>
          </div>
        )}
      </div>
      <div>
        {index === 0 && <label style={labelStyle}>Qty</label>}
        <input style={inputStyle} type="number" min="1" max={selected?.quantity || 9999}
          value={item.quantity} onChange={(e) => onChange(index, 'quantity', e.target.value)} required placeholder="1" />
        {selected && item.quantity > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Subtotal: <strong style={{ color: 'var(--color-success)' }}>${(selected.price * Number(item.quantity)).toFixed(2)}</strong>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: index === 0 ? 22 : 0 }}>
        <button type="button" className="btn btn-danger" style={{ padding: '8px 12px' }}
          onClick={() => onRemove(index)} disabled={!canRemove} title="Remove item">✕</button>
      </div>
    </div>
  );
}

function CreateOrderForm({ customers, products, onSubmit, onCancel, submitting, error }) {
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);

  const addItem    = () => setItems((p) => [...p, { product_id: '', quantity: 1 }]);
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i, f, v) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it));

  const estimatedTotal = items.reduce((sum, item) => {
    const p = products.find((p) => p.id === Number(item.product_id));
    return p && item.quantity ? sum + p.price * Number(item.quantity) : sum;
  }, 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      customer_id: parseInt(customerId, 10),
      status: 'pending',
      items: items.map((it) => ({ product_id: parseInt(it.product_id, 10), quantity: parseInt(it.quantity, 10) })),
    });
  };

  return (
    <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
      <h3 style={{ marginBottom: 'var(--space-lg)' }}>🛒 Place New Order</h3>
      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>⚠️ {error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={labelStyle}>Customer *</label>
          {customers.length === 0
            ? <div className="alert alert-error">No customers found — register a customer first.</div>
            : (
              <select style={selectStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">— Select a customer —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
            )}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
            <label style={labelStyle}>Order Items *</label>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={addItem}>
              + Add Item
            </button>
          </div>
          {items.map((item, i) => (
            <OrderItemRow key={i} index={i} item={item} products={products}
              onChange={updateItem} onRemove={removeItem} canRemove={items.length > 1} />
          ))}
        </div>

        {estimatedTotal > 0 && (
          <div style={{
            textAlign: 'right', padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)',
            background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem',
          }}>
            Estimated Total:{' '}
            <strong style={{ fontSize: '1.1rem', color: 'var(--color-success)' }}>${estimatedTotal.toFixed(2)}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting || customers.length === 0}>
            {submitting ? 'Placing…' : '✅ Place Order'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function Orders() {
  const [orders,    setOrders]    = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');
  const [success,    setSuccess]    = useState('');
  const [pageError,  setPageError]  = useState('');

  const fetchAll = useCallback(() => {
    setLoading(true);
    setPageError('');
    Promise.all([api.get('/api/v1/orders'), api.get('/api/v1/customers'), api.get('/api/v1/products')])
      .then(([o, c, p]) => { setOrders(o.data); setCustomers(c.data); setProducts(p.data); })
      .catch((err) => setPageError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3500);
    return () => clearTimeout(t);
  }, [success]);

  const openForm  = () => { setShowForm(true);  setFormError(''); };
  const closeForm = () => { setShowForm(false); setFormError(''); };

  const handleCreate = async (payload) => {
    setFormError(''); setSubmitting(true);
    try {
      const res = await api.post('/api/v1/orders', payload);
      setSuccess(`✅ Order #${res.data.id} placed successfully.`);
      closeForm(); fetchAll();
    } catch (err) { setFormError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (order) => {
    const name = order.customer?.name ?? `Customer #${order.customer_id}`;
    if (!window.confirm(`Cancel Order #${order.id}?\nCustomer: ${name}\nTotal: $${parseFloat(order.total_amount).toFixed(2)}\n\nStock will be restored.`)) return;
    try {
      await api.delete(`/api/v1/orders/${order.id}`);
      setSuccess(`✅ Order #${order.id} cancelled — stock restored.`);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (err) { setPageError(`Failed to cancel Order #${order.id}: ${err.message}`); }
  };

  const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_amount), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>🛒 Orders</h1>
          <p className="page-subtitle">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
            {orders.length > 0 && <> · Revenue: <strong style={{ color: 'var(--color-success)' }}>${totalRevenue.toFixed(2)}</strong></>}
          </p>
        </div>
        <button className={showForm ? 'btn btn-ghost' : 'btn btn-primary'} onClick={showForm ? closeForm : openForm}>
          {showForm ? '✕ Cancel' : '+ New Order'}
        </button>
      </div>

      {success   && <div className="alert alert-success">{success}</div>}
      {pageError && <div className="alert alert-error">⚠️ {pageError}</div>}

      {showForm && (
        <CreateOrderForm customers={customers} products={products}
          onSubmit={handleCreate} onCancel={closeForm} submitting={submitting} error={formError} />
      )}

      {loading ? (
        <div className="state-container"><div className="spinner" /><span>Loading orders…</span></div>
      ) : orders.length === 0 ? (
        <div className="state-container">
          <div className="state-icon">🛒</div>
          <div className="state-title">No orders yet</div>
          <div className="state-sub">Click "New Order" to place the first order.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order #</th><th>Customer</th><th>Items</th>
                  <th>Total</th><th>Status</th><th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`} style={{ fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                        #{String(o.id).padStart(4, '0')}
                      </Link>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.customer?.name ?? `Customer #${o.customer_id}`}</div>
                      {o.customer?.email && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{o.customer.email}</div>}
                    </td>
                    <td className="td-muted">{(o.order_items?.length ?? 0)} item{o.order_items?.length !== 1 ? 's' : ''}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>${parseFloat(o.total_amount).toFixed(2)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="td-muted">{new Date(o.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                        <Link to={`/orders/${o.id}`} className="btn btn-ghost" style={{ padding: '5px 14px', fontSize: '0.8rem' }}>👁 View</Link>
                        <button className="btn btn-danger" style={{ padding: '5px 14px', fontSize: '0.8rem' }}
                          onClick={() => handleDelete(o)} title="Cancel order and restore stock">🚫 Cancel</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 'var(--space-sm) var(--space-lg)', borderTop: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Showing {orders.length} order{orders.length !== 1 ? 's' : ''}</span>
            <span>Total Revenue: <strong style={{ color: 'var(--color-success)' }}>${totalRevenue.toFixed(2)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
