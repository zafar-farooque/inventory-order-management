import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

/* ─── Constants ─────────────────────────────────────────────────────────── */
const EMPTY_FORM = { name: '', email: '', phone: '' };

/* ─── Shared input / label styles ───────────────────────────────────────── */
const inputStyle = {
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 14px',
  color: 'var(--color-text)',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.2s',
};

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: '0.78rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 500,
};

/* ─── CustomerForm ───────────────────────────────────────────────────────── */
/**
 * Controlled form for adding a new customer.
 * Props:
 *   onSubmit(data)  — called with { name, email, phone? } on valid submit
 *   onCancel()      — called when the user dismisses the form
 *   submitting      — disables inputs while a request is in flight
 *   error           — API / validation error string to show inside the form
 */
function CustomerForm({ onSubmit, onCancel, submitting, error }) {
  const [form, setForm] = useState(EMPTY_FORM);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name:  form.name.trim(),
      email: form.email.trim(),
    };
    // phone is optional — only include if the user typed something
    if (form.phone.trim()) payload.phone = form.phone.trim();
    onSubmit(payload);
  };

  return (
    <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
      <h3 style={{ marginBottom: 'var(--space-md)' }}>➕ Register New Customer</h3>

      {/* Form-level API error */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
          ⚠️ {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        {/* Name */}
        <div>
          <label style={labelStyle}>Full Name *</label>
          <input
            style={inputStyle}
            name="name"
            type="text"
            placeholder="e.g. Jane Smith"
            value={form.name}
            onChange={handleChange}
            required
            minLength={1}
            maxLength={255}
            disabled={submitting}
          />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>Email Address *</label>
          <input
            style={inputStyle}
            name="email"
            type="email"
            placeholder="jane@example.com"
            value={form.email}
            onChange={handleChange}
            required
            disabled={submitting}
          />
        </div>

        {/* Phone */}
        <div>
          <label style={labelStyle}>Phone <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <input
            style={inputStyle}
            name="phone"
            type="tel"
            placeholder="+1 555 000 1234"
            value={form.phone}
            onChange={handleChange}
            maxLength={20}
            disabled={submitting}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignSelf: 'end' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : '👤 Register'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Customers Page ─────────────────────────────────────────────────────── */
export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);

  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState('');

  const [success, setSuccess]   = useState('');
  const [pageError, setPageError] = useState('');

  /* ── Fetch all customers ── */
  const fetchCustomers = useCallback(() => {
    setLoading(true);
    setPageError('');
    api.get('/api/v1/customers')
      .then((res) => setCustomers(res.data))
      .catch((err) => setPageError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  /* Auto-dismiss success banner after 3.5 s */
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3500);
    return () => clearTimeout(t);
  }, [success]);

  /* ── Open / close form ── */
  const openForm  = () => { setShowForm(true);  setFormError(''); };
  const closeForm = () => { setShowForm(false); setFormError(''); };

  /* ── POST /customers ── */
  const handleCreate = async (payload) => {
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/api/v1/customers', payload);
      setSuccess(`✅ "${payload.name}" registered successfully.`);
      closeForm();
      fetchCustomers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── DELETE /customers/{id} ── */
  const handleDelete = async (customer) => {
    const confirmed = window.confirm(
      `Delete customer "${customer.name}"?\n\n` +
      `Email: ${customer.email}\n\n` +
      'This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      await api.delete(`/api/v1/customers/${customer.id}`);
      setSuccess(`✅ "${customer.name}" deleted.`);
      // Optimistically remove from list without refetching
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
    } catch (err) {
      setPageError(`⚠️ Failed to delete "${customer.name}": ${err.message}`);
    }
  };

  /* ── Derive avatar initials ── */
  const initials = (name) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');

  /* ── Colour from customer id (for avatar) ── */
  const avatarColor = (id) => {
    const colors = [
      '#6c63ff', '#38bdf8', '#22c55e', '#f59e0b',
      '#ec4899', '#a78bfa', '#34d399', '#fb923c',
    ];
    return colors[id % colors.length];
  };

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1>👥 Customers</h1>
          <p className="page-subtitle">
            {customers.length} registered customer{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className={showForm ? 'btn btn-ghost' : 'btn btn-primary'}
          onClick={showForm ? closeForm : openForm}
        >
          {showForm ? '✕ Cancel' : '+ Add Customer'}
        </button>
      </div>

      {/* ── Feedback banners ── */}
      {success   && <div className="alert alert-success">{success}</div>}
      {pageError && <div className="alert alert-error">⚠️ {pageError}</div>}

      {/* ── Add Customer form ── */}
      {showForm && (
        <CustomerForm
          onSubmit={handleCreate}
          onCancel={closeForm}
          submitting={submitting}
          error={formError}
        />
      )}

      {/* ── Customers table ── */}
      {loading ? (
        <div className="state-container">
          <div className="spinner" />
          <span>Loading customers…</span>
        </div>
      ) : customers.length === 0 ? (
        <div className="state-container">
          <div className="state-icon">👥</div>
          <div className="state-title">No customers yet</div>
          <div className="state-sub">
            Click "Add Customer" to register your first customer.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    {/* Avatar + name */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 36, height: 36,
                            borderRadius: '50%',
                            background: avatarColor(c.id),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 700,
                            color: '#fff', flexShrink: 0,
                            userSelect: 'none',
                          }}
                        >
                          {initials(c.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                            #{c.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td>
                      <a href={`mailto:${c.email}`} style={{ color: 'var(--color-info)' }}>
                        {c.email}
                      </a>
                    </td>

                    {/* Phone */}
                    <td className="td-muted">
                      {c.phone
                        ? <a href={`tel:${c.phone}`} style={{ color: 'var(--color-text-muted)' }}>{c.phone}</a>
                        : '—'}
                    </td>

                    {/* Registered date */}
                    <td className="td-muted">
                      {new Date(c.created_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '5px 14px', fontSize: '0.8rem' }}
                        onClick={() => handleDelete(c)}
                        title={`Delete ${c.name}`}
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          <div style={{
            padding: 'var(--space-sm) var(--space-lg)',
            borderTop: '1px solid var(--color-border)',
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
            textAlign: 'right',
          }}>
            Showing {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
