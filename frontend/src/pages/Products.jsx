import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

/* ─── Constants ─────────────────────────────────────────────────────────── */
const EMPTY_FORM = { name: '', sku: '', price: '', quantity: '' };

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function stockBadge(qty) {
  if (qty === 0) return <span className="badge badge-cancelled">Out of stock</span>;
  if (qty < 10)  return <span className="badge badge-pending">Low stock</span>;
  return              <span className="badge badge-success">In stock</span>;
}

/* ─── ProductForm (Add & Edit) ──────────────────────────────────────────── */
function ProductForm({ initial, onSubmit, onCancel, submitting, error }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const isEdit = Boolean(initial?.id);

  /* Sync when the parent changes `initial` (e.g. user clicks Edit on a diff row) */
  useEffect(() => { setForm(initial || EMPTY_FORM); }, [initial]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...(isEdit ? { id: initial.id } : {}),
      name:     form.name.trim(),
      sku:      form.sku.trim(),
      price:    parseFloat(form.price),
      quantity: parseInt(form.quantity, 10),
    });
  };

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

  return (
    <div
      className="card"
      style={{
        marginBottom: 'var(--space-xl)',
        borderColor: isEdit ? 'var(--color-primary)' : 'var(--color-border)',
      }}
    >
      <h3 style={{ marginBottom: 'var(--space-md)' }}>
        {isEdit ? `✏️ Edit Product — ${initial.name}` : '➕ Add New Product'}
      </h3>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
          ⚠️ {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        <div>
          <label style={labelStyle}>Product Name *</label>
          <input
            style={inputStyle}
            name="name"
            type="text"
            placeholder="e.g. Wireless Mouse"
            value={form.name}
            onChange={handleChange}
            required
            minLength={1}
            maxLength={255}
          />
        </div>

        <div>
          <label style={labelStyle}>SKU *</label>
          <input
            style={inputStyle}
            name="sku"
            type="text"
            placeholder="e.g. WM-001"
            value={form.sku}
            onChange={handleChange}
            required
            minLength={1}
            maxLength={100}
          />
        </div>

        <div>
          <label style={labelStyle}>Price ($) *</label>
          <input
            style={inputStyle}
            name="price"
            type="number"
            placeholder="0.00"
            value={form.price}
            onChange={handleChange}
            required
            min="0.01"
            step="0.01"
          />
        </div>

        <div>
          <label style={labelStyle}>Quantity *</label>
          <input
            style={inputStyle}
            name="quantity"
            type="number"
            placeholder="0"
            value={form.quantity}
            onChange={handleChange}
            required
            min="0"
            step="1"
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignSelf: 'end' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? (isEdit ? 'Saving…' : 'Adding…')
              : (isEdit ? '💾 Save Changes' : '➕ Add Product')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: '0.78rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 500,
};

/* ─── Products Page ─────────────────────────────────────────────────────── */
export default function Products() {
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);

  /* Form visibility: null = hidden, 'add' = add mode, product obj = edit mode */
  const [formMode, setFormMode]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  /* Global page-level feedback */
  const [success, setSuccess]     = useState('');
  const [pageError, setPageError] = useState('');

  /* ── Fetch ── */
  const fetchProducts = useCallback(() => {
    setLoading(true);
    api.get('/api/v1/products')
      .then((res) => setProducts(res.data))
      .catch((err) => setPageError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  /* ── Auto-dismiss success banner ── */
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3500);
    return () => clearTimeout(t);
  }, [success]);

  /* ── Open Add form ── */
  const openAdd = () => {
    setFormMode('add');
    setFormError('');
  };

  /* ── Open Edit form pre-filled with product data ── */
  const openEdit = (product) => {
    setFormMode({
      id:       product.id,
      name:     product.name,
      sku:      product.sku,
      price:    String(product.price),
      quantity: String(product.quantity),
    });
    setFormError('');
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => { setFormMode(null); setFormError(''); };

  /* ── Submit: Add or Edit ── */
  const handleFormSubmit = async (data) => {
    setFormError('');
    setSubmitting(true);
    try {
      if (data.id) {
        /* ── PUT /products/{id} ── */
        await api.put(`/api/v1/products/${data.id}`, {
          name:     data.name,
          sku:      data.sku,
          price:    data.price,
          quantity: data.quantity,
        });
        setSuccess(`✅ "${data.name}" updated successfully.`);
      } else {
        /* ── POST /products ── */
        await api.post('/api/v1/products', {
          name:     data.name,
          sku:      data.sku,
          price:    data.price,
          quantity: data.quantity,
        });
        setSuccess(`✅ "${data.name}" added to catalogue.`);
      }
      closeForm();
      fetchProducts();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}" (SKU: ${product.sku})?\n\nThis cannot be undone.`)) return;
    try {
      await api.delete(`/api/v1/products/${product.id}`);
      setSuccess(`✅ "${product.name}" deleted.`);
      fetchProducts();
    } catch (err) {
      setPageError(err.message);
    }
  };

  /* ── Compute initial values for the form ── */
  const formInitial = formMode === 'add' ? EMPTY_FORM : formMode; // null hides form

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1>📦 Products</h1>
          <p className="page-subtitle">
            {products.length} product{products.length !== 1 ? 's' : ''} in catalogue
          </p>
        </div>
        <button
          className={formMode ? 'btn btn-ghost' : 'btn btn-primary'}
          onClick={formMode ? closeForm : openAdd}
        >
          {formMode ? '✕ Cancel' : '+ Add Product'}
        </button>
      </div>

      {/* ── Feedback banners ── */}
      {success   && <div className="alert alert-success">{success}</div>}
      {pageError && <div className="alert alert-error">⚠️ {pageError}</div>}

      {/* ── Add / Edit form ── */}
      {formMode !== null && (
        <ProductForm
          initial={formInitial}
          onSubmit={handleFormSubmit}
          onCancel={closeForm}
          submitting={submitting}
          error={formError}
        />
      )}

      {/* ── Products table ── */}
      {loading ? (
        <div className="state-container">
          <div className="spinner" />
          <span>Loading products…</span>
        </div>
      ) : products.length === 0 ? (
        <div className="state-container">
          <div className="state-icon">📦</div>
          <div className="state-title">No products yet</div>
          <div className="state-sub">Click "Add Product" to add your first item to the catalogue.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Stock</th>
                  <th>Added</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isBeingEdited = formMode?.id === p.id;
                  return (
                    <tr
                      key={p.id}
                      style={{
                        background: isBeingEdited
                          ? 'rgba(108, 99, 255, 0.06)'
                          : undefined,
                        outline: isBeingEdited
                          ? '1px solid rgba(108, 99, 255, 0.3)'
                          : undefined,
                      }}
                    >
                      <td className="td-muted">{p.id}</td>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td><span className="chip">{p.sku}</span></td>
                      <td>${parseFloat(p.price).toFixed(2)}</td>
                      <td>{p.quantity}</td>
                      <td>{stockBadge(p.quantity)}</td>
                      <td className="td-muted">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                          {/* ── Edit button ── */}
                          <button
                            className={`btn ${isBeingEdited ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ padding: '5px 14px', fontSize: '0.8rem' }}
                            onClick={() => isBeingEdited ? closeForm() : openEdit(p)}
                            title={isBeingEdited ? 'Cancel edit' : `Edit ${p.name}`}
                          >
                            {isBeingEdited ? '✕ Editing' : '✏️ Edit'}
                          </button>

                          {/* ── Delete button ── */}
                          <button
                            className="btn btn-danger"
                            style={{ padding: '5px 14px', fontSize: '0.8rem' }}
                            onClick={() => handleDelete(p)}
                            title={`Delete ${p.name}`}
                          >
                            🗑 Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
