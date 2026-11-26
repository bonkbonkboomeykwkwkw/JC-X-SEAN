import { useEffect, useMemo, useRef, useState } from 'react';
import { api, authExpiredEvent, clearAuthSession } from './api';
import { categories } from '../../shared/categories.js';
import './admin-page.css';

const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const PROGRESS_STEPS = ['Pending', 'Processing', 'Shipped', 'Delivered'];
const ALLOWED_TRANSITIONS = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};
const BADGE_PRESETS = ['Popular', 'New', 'Bestseller', 'Essential'];
const TAB_META = {
  overview: { label: 'Overview', path: '/admin', title: 'Store overview', subtitle: 'Live catalog health, recent orders, and cash-on-delivery tracking.' },
  orders: { label: 'Orders', path: '/admin/orders', title: 'Order management', subtitle: 'Review customer orders, advance fulfillment statuses, and settle COD payments.' },
  products: { label: 'Products', path: '/admin/products', title: 'Product catalog', subtitle: 'Create, update, and organize gadgets across all store categories.' },
};

const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number.isFinite(value) ? value : 0);

function formatDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-US', options);
}

function isValidImagePath(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    return ['https:', 'http:'].includes(new URL(trimmed).protocol);
  } catch {
    if (!trimmed.startsWith('/images/')) return false;
    try {
      const decoded = decodeURIComponent(trimmed);
      return !decoded.includes('\\') && !decoded.split('/').includes('..') && /\.(?:jpe?g|png|webp|avif)$/i.test(decoded);
    } catch {
      return false;
    }
  }
}

function statusClassName(status) {
  return ORDER_STATUSES.includes(status) ? `status-${status.toLowerCase()}` : 'status-legacy';
}

function paymentClassName(paymentStatus) {
  if (paymentStatus === 'Paid') return 'payment-paid';
  if (paymentStatus === 'Cancelled') return 'payment-cancelled';
  return 'payment-pending';
}

function ProductThumb({ src, alt }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (!src || failed) return <span className="admin-thumb-fallback">No image</span>;
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

function OverviewSection({
  products,
  orders,
  onSelectTab,
  onInspectOrder,
  onSelectCategory,
  onAddProduct,
}) {
  const validTotalOrders = orders.filter(order => order.status !== 'Cancelled');
  const totalRevenue = validTotalOrders.reduce((sum, order) => sum + (Number.isFinite(order.total) ? order.total : 0), 0);
  const activeOrders = orders.filter(order => ['Pending', 'Processing', 'Shipped'].includes(order.status));
  const pendingOrders = orders.filter(order => order.status === 'Pending');
  const deliveredOrders = orders.filter(order => order.status === 'Delivered');

  const paidRevenue = orders
    .filter(order => order.paymentStatus === 'Paid')
    .reduce((sum, order) => sum + (Number.isFinite(order.total) ? order.total : 0), 0);
  const pendingCodRevenue = orders
    .filter(order => order.status !== 'Cancelled' && order.paymentStatus === 'Pending')
    .reduce((sum, order) => sum + (Number.isFinite(order.total) ? order.total : 0), 0);
  const cancelledCount = orders.filter(order => order.status === 'Cancelled').length;

  const maxCategoryCount = Math.max(
    1,
    ...categories.map(cat => products.filter(p => p.category === cat).length),
  );

  return <>
    <section className="admin-kpi-grid" aria-label="Store metrics">
      <article className="admin-kpi-card">
        <span className="admin-kpi-label">Active order volume</span>
        <strong className="admin-kpi-value">{money(totalRevenue)}</strong>
        <span className="admin-kpi-meta">Excludes {cancelledCount} cancelled {cancelledCount === 1 ? 'order' : 'orders'}</span>
      </article>
      <article className="admin-kpi-card">
        <span className="admin-kpi-label">Orders in progress</span>
        <strong className="admin-kpi-value">{activeOrders.length}</strong>
        <span className="admin-kpi-meta">{pendingOrders.length} pending confirmation</span>
      </article>
      <article className="admin-kpi-card">
        <span className="admin-kpi-label">Total orders</span>
        <strong className="admin-kpi-value">{orders.length}</strong>
        <span className="admin-kpi-meta">{deliveredOrders.length} delivered to customers</span>
      </article>
      <article className="admin-kpi-card">
        <span className="admin-kpi-label">Catalog products</span>
        <strong className="admin-kpi-value">{products.length}</strong>
        <span className="admin-kpi-meta">Across {categories.length} gadget categories</span>
      </article>
    </section>

    <section className="admin-overview-grid">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Recent orders</h2>
          <button type="button" className="admin-link-btn" onClick={() => onSelectTab('orders')}>Manage all orders →</button>
        </div>
        {!orders.length ? <div className="admin-empty-box">No customer orders placed yet.</div> : <div className="admin-recent-orders">
          {orders.slice(0, 6).map(order => {
            const items = Array.isArray(order.items) ? order.items : [];
            const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const status = typeof order.status === 'string' && order.status ? order.status : 'Legacy';
            return <button
              type="button"
              key={order._id}
              className="admin-recent-order-row"
              onClick={() => onInspectOrder(order._id)}
            >
              <div className="admin-recent-order-main">
                <strong>{order.customer?.name || 'Customer'} · {money(order.total)}</strong>
                <span>{itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatDate(order.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <div className="admin-recent-order-right">
                <span className={`admin-status-pill ${statusClassName(order.status)}`}>{status}</span>
                <span>→</span>
              </div>
            </button>;
          })}
        </div>}
      </div>

      <div className="admin-overview-side">
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>COD payment summary</h2>
            <button type="button" className="admin-link-btn" onClick={() => onSelectTab('orders')}>View orders →</button>
          </div>
          <div className="admin-payment-breakdown">
            <div className="admin-payment-stat">
              <span>Collected (Paid)</span>
              <strong>{money(paidRevenue)}</strong>
            </div>
            <div className="admin-payment-stat">
              <span>Pending collection</span>
              <strong>{money(pendingCodRevenue)}</strong>
            </div>
            <div className="admin-payment-stat">
              <span>Delivered awaiting COD settlement</span>
              <strong>{deliveredOrders.filter(o => o.paymentStatus === 'Pending').length}</strong>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Catalog by category</h2>
            <button type="button" className="admin-link-btn" onClick={onAddProduct}>+ Add product</button>
          </div>
          <div className="admin-category-list">
            {categories.map(category => {
              const count = products.filter(p => p.category === category).length;
              const widthPercent = Math.round((count / maxCategoryCount) * 100);
              return <button
                type="button"
                key={category}
                className="admin-category-row"
                onClick={() => onSelectCategory(category)}
              >
                <div className="admin-category-row-top">
                  <span>{category}</span>
                  <span>{count} {count === 1 ? 'item' : 'items'}</span>
                </div>
                <div className="admin-category-bar">
                  <div className="admin-category-bar-fill" style={{ width: `${widthPercent}%` }} />
                </div>
              </button>;
            })}
          </div>
        </div>
      </div>
    </section>
  </>;
}

function OrderInspector({
  order,
  history,
  historyLoading,
  historyError,
  actionBusy,
  actionError,
  statusNote,
  onStatusNoteChange,
  onTransitionStatus,
  onUpdatePayment,
  onReloadHistory,
}) {
  if (!order) {
    return <aside className="admin-inspector-empty">
      Select an order from the list to inspect customer details, update fulfillment status, record COD payment, or review status history.
    </aside>;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const hasStandardStatus = typeof order.status === 'string' && ORDER_STATUSES.includes(order.status);
  const displayStatus = typeof order.status === 'string' && order.status ? order.status : 'Legacy';
  const nextStatuses = hasStandardStatus ? ALLOWED_TRANSITIONS[order.status] : [];
  const currentStepIndex = PROGRESS_STEPS.indexOf(order.status);
  const hasCodTracking = order.paymentMethod === 'COD' && typeof order.paymentStatus === 'string' && Boolean(order.paymentStatus);

  return <aside className="admin-inspector" aria-label="Selected order details">
    <div className="admin-inspector-head">
      <div>
        <span className="admin-order-id">ORDER #{order._id}</span>
        <h2>{order.customer?.name || 'Unnamed customer'}</h2>
        <p>Placed {formatDate(order.createdAt)}</p>
      </div>
      <span className={`admin-status-pill ${statusClassName(order.status)}`}>{displayStatus}</span>
    </div>

    {hasStandardStatus && order.status !== 'Cancelled' && (
      <div className="admin-stepper" aria-label="Fulfillment progress">
        {PROGRESS_STEPS.map((step, index) => {
          const cls = index === currentStepIndex ? 'current' : index < currentStepIndex ? 'done' : '';
          return <div key={step} className={`admin-step ${cls}`}>{step}</div>;
        })}
      </div>
    )}

    <section className="admin-inspector-section">
      <h3>Fulfillment status</h3>
      {actionError && <p className="admin-error-banner" role="alert">{actionError}</p>}
      {!hasStandardStatus ? (
        <p className="admin-muted-note">This legacy order does not use the standard status workflow and cannot be transitioned.</p>
      ) : nextStatuses.length === 0 ? (
        <p className="admin-muted-note">This order is <strong>{order.status}</strong> (terminal state — no further status changes).</p>
      ) : <>
        <textarea
          className="admin-note-input"
          rows={2}
          maxLength={500}
          value={statusNote}
          disabled={actionBusy}
          onChange={e => onStatusNoteChange(e.target.value)}
          placeholder="Optional status note (e.g. Packed, handed to courier)…"
          aria-label="Status update note"
        />
        <div className="admin-action-row">
          {nextStatuses.map(target => (
            <button
              key={target}
              type="button"
              disabled={actionBusy}
              className={target === 'Cancelled' ? 'admin-btn-danger' : 'admin-btn-primary'}
              onClick={() => onTransitionStatus(order._id, target)}
            >
              {actionBusy ? 'Updating…' : target === 'Cancelled' ? 'Cancel order' : `Mark as ${target}`}
            </button>
          ))}
        </div>
      </>}
    </section>

    <section className="admin-inspector-section">
      <h3>COD payment tracking</h3>
      {!hasCodTracking ? (
        <p className="admin-muted-note">This legacy order does not have COD payment tracking.</p>
      ) : <>
        <div className="admin-detail-kv">
          <div><span>Method</span><strong>{order.paymentMethod}</strong></div>
          <div>
            <span>Payment status</span>
            <span className={`admin-status-pill ${paymentClassName(order.paymentStatus)}`}>{order.paymentStatus}</span>
          </div>
        </div>
        {order.paymentStatus === 'Pending' && order.status === 'Delivered' && (
          <div className="admin-action-row">
            <button
              type="button"
              disabled={actionBusy}
              className="admin-btn-primary"
              onClick={() => onUpdatePayment(order._id, 'Paid')}
            >
              {actionBusy ? 'Updating…' : 'Mark COD as Paid'}
            </button>
          </div>
        )}
        {order.paymentStatus === 'Pending' && order.status === 'Cancelled' && (
          <div className="admin-action-row">
            <button
              type="button"
              disabled={actionBusy}
              className="admin-btn-danger"
              onClick={() => onUpdatePayment(order._id, 'Cancelled')}
            >
              {actionBusy ? 'Updating…' : 'Mark payment Cancelled'}
            </button>
          </div>
        )}
        {order.paymentStatus === 'Pending' && !['Delivered', 'Cancelled'].includes(order.status) && (
          <p className="admin-muted-note">Payment can be marked Paid once the order is Delivered.</p>
        )}
      </>}
    </section>

    <section className="admin-inspector-section">
      <h3>Customer &amp; delivery</h3>
      <div className="admin-detail-kv">
        <div><span>Email</span><strong>{order.customer?.email || '—'}</strong></div>
        {order.contactNumber && <div><span>Contact</span><strong>{order.contactNumber}</strong></div>}
        <div><span>Address</span><strong className="admin-detail-address">{order.shippingAddress || order.customer?.address || '—'}</strong></div>
      </div>
    </section>

    <section className="admin-inspector-section">
      <h3>Items &amp; totals</h3>
      {!items.length ? <p className="admin-muted-note">No line items recorded.</p> : <div className="admin-items-mini">
        {items.map((item, idx) => (
          <div className="admin-item-mini-row" key={`${item.product || item.name}-${idx}`}>
            <span>
              {item.name}
              <small>{money(item.price)} × {item.quantity}</small>
            </span>
            <strong>{money((item.price || 0) * (item.quantity || 0))}</strong>
          </div>
        ))}
      </div>}
      <div className="admin-detail-kv">
        <div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div>
        <div><span>Shipping</span><strong>{order.shipping ? money(order.shipping) : 'Free'}</strong></div>
        <div><span>Total</span><strong>{money(order.total)}</strong></div>
      </div>
    </section>

    <section className="admin-inspector-section">
      <div className="admin-card-header" style={{ marginBottom: 4 }}>
        <h3>Status history</h3>
        <button type="button" className="admin-link-btn" onClick={onReloadHistory} disabled={historyLoading}>Refresh</button>
      </div>
      {historyLoading ? (
        <p className="admin-muted-note">Loading status history…</p>
      ) : historyError ? (
        <p className="admin-muted-note">{historyError}</p>
      ) : !history.length ? (
        <p className="admin-muted-note">No status transitions recorded for this order.</p>
      ) : (
        <div className="admin-timeline">
          {history.map(entry => (
            <div className="admin-timeline-entry" key={entry._id}>
              <strong>{entry.previousStatus ? `${entry.previousStatus} → ${entry.newStatus}` : `Placed (${entry.newStatus})`}</strong>
              <span>{formatDate(entry.createdAt)}</span>
              {entry.note && <p className="admin-timeline-note">{entry.note}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  </aside>;
}

function OrdersSection({
  orders,
  loading,
  selectedOrderId,
  onSelectOrder,
  historyState,
  onReloadHistory,
  onTransitionStatus,
  onUpdatePayment,
  actionBusy,
  actionError,
  statusNote,
  onStatusNoteChange,
}) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');

  const hasLegacy = orders.some(o => !ORDER_STATUSES.includes(o.status));
  const filterTabs = ['All', ...ORDER_STATUSES, ...(hasLegacy ? ['Legacy'] : [])];

  const countForFilter = tab => {
    if (tab === 'All') return orders.length;
    if (tab === 'Legacy') return orders.filter(o => !ORDER_STATUSES.includes(o.status)).length;
    return orders.filter(o => o.status === tab).length;
  };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = orders.filter(order => {
      const matchesStatus = statusFilter === 'All'
        ? true
        : statusFilter === 'Legacy'
          ? !ORDER_STATUSES.includes(order.status)
          : order.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      const itemsText = Array.isArray(order.items) ? order.items.map(i => i.name).join(' ') : '';
      return `${order._id} ${order.customer?.name || ''} ${order.customer?.email || ''} ${itemsText}`.toLowerCase().includes(q);
    });
    const sorted = [...list];
    if (sort === 'oldest') sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else if (sort === 'high') sorted.sort((a, b) => (b.total || 0) - (a.total || 0));
    else if (sort === 'low') sorted.sort((a, b) => (a.total || 0) - (b.total || 0));
    else sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted;
  }, [orders, statusFilter, search, sort]);

  const activeOrder = orders.find(o => o._id === selectedOrderId) || filteredOrders[0] || null;

  return <>
    <div className="admin-toolbar">
      <div className="admin-filter-pills" role="tablist" aria-label="Filter orders by status">
        {filterTabs.map(tab => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab}
            className={`admin-pill ${statusFilter === tab ? 'selected' : ''}`}
            onClick={() => setStatusFilter(tab)}
          >
            {tab} <span>{countForFilter(tab)}</span>
          </button>
        ))}
      </div>
      <div className="admin-controls-right">
        <label className="admin-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order ID, customer, item…"
            aria-label="Search orders"
          />
        </label>
        <select className="admin-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort orders">
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
          <option value="high">Total: High to low</option>
          <option value="low">Total: Low to high</option>
        </select>
      </div>
    </div>

    {loading && !orders.length ? (
      <div className="admin-empty-box" role="status">Loading orders…</div>
    ) : !filteredOrders.length ? (
      <div className="admin-empty-box">No orders match the current filter.</div>
    ) : (
      <div className="admin-orders-workspace">
        <div className="admin-orders-list">
          {filteredOrders.map(order => {
            const items = Array.isArray(order.items) ? order.items : [];
            const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const displayStatus = typeof order.status === 'string' && order.status ? order.status : 'Legacy';
            const selected = activeOrder?._id === order._id;
            return (
              <button
                type="button"
                key={order._id}
                className={`admin-order-card ${selected ? 'selected' : ''}`}
                onClick={() => onSelectOrder(order._id)}
              >
                <div className="admin-order-card-top">
                  <div>
                    <span className="admin-order-id">#{order._id}</span>
                    <strong className="admin-order-customer">{order.customer?.name || 'Customer'}</strong>
                    <span className="admin-order-email">{order.customer?.email || 'No email'}</span>
                  </div>
                  <div className="admin-order-badges">
                    <span className={`admin-status-pill ${statusClassName(order.status)}`}>{displayStatus}</span>
                    {order.paymentStatus && (
                      <span className={`admin-status-pill ${paymentClassName(order.paymentStatus)}`}>
                        {order.paymentMethod || 'COD'} · {order.paymentStatus}
                      </span>
                    )}
                  </div>
                </div>
                <div className="admin-order-card-bottom">
                  <span>{itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatDate(order.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <strong>{money(order.total)}</strong>
                </div>
              </button>
            );
          })}
        </div>

        <OrderInspector
          order={activeOrder}
          history={historyState.items}
          historyLoading={historyState.loading}
          historyError={historyState.error}
          actionBusy={actionBusy}
          actionError={actionError}
          statusNote={statusNote}
          onStatusNoteChange={onStatusNoteChange}
          onTransitionStatus={onTransitionStatus}
          onUpdatePayment={onUpdatePayment}
          onReloadHistory={() => activeOrder && onReloadHistory(activeOrder._id)}
        />
      </div>
    )}
  </>;
}

function ProductFormModal({ editing, busy, error, defaultCategory, onSave, onClose }) {
  const [imageValue, setImageValue] = useState(editing?.image || '');
  const [badgeValue, setBadgeValue] = useState(editing?.badge || '');
  const [clientError, setClientError] = useState('');

  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') || '').trim(),
      price: Number(form.get('price')),
      category: String(form.get('category') || ''),
      description: String(form.get('description') || '').trim(),
      image: imageValue.trim(),
      badge: badgeValue.trim(),
    };

    if (!payload.name || !payload.description || !Number.isFinite(payload.price) || payload.price < 0.01) {
      setClientError('Provide a valid name, short specifications, and a positive price.');
      return;
    }
    if (!isValidImagePath(payload.image)) {
      setClientError('Use an https:// or http:// image URL, or a local /images/... path ending in .jpg, .png, .webp, or .avif.');
      return;
    }
    setClientError('');
    onSave(payload);
  }

  return <div className="admin-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-product-modal-title">
      <div className="admin-modal-head">
        <h2 id="admin-product-modal-title">{editing ? 'Edit product' : 'Add new product'}</h2>
        <button type="button" className="admin-modal-close" onClick={onClose} disabled={busy} aria-label="Close modal">×</button>
      </div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Product name
          <input name="name" defaultValue={editing?.name || ''} required maxLength={80} placeholder="e.g. Sony WH-CH720N Headphones" />
        </label>
        <div className="admin-form-grid">
          <label>
            Price (₱)
            <input name="price" type="number" min="0.01" max="1000000" step="0.01" defaultValue={editing?.price ?? ''} required />
          </label>
          <label>
            Category
            <select name="category" defaultValue={editing?.category || defaultCategory || categories[0]}>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>
        </div>
        <label>
          Short specifications
          <input name="description" defaultValue={editing?.description || ''} required maxLength={100} placeholder="e.g. 6.1-inch OLED · 128GB · 5G" />
        </label>
        <div className="admin-image-field">
          <label>
            Image URL or local path
            <input
              name="image"
              type="text"
              value={imageValue}
              onChange={e => { setImageValue(e.target.value); setClientError(''); }}
              required
              placeholder="/images/samsunggalaxy.webp or https://..."
            />
            <span className="admin-form-hint">Supports https:// URLs or /images/*.webp|jpg|png paths</span>
          </label>
          <div className="admin-image-preview" aria-label="Image preview">
            <ProductThumb src={imageValue.trim()} alt="Preview" />
          </div>
        </div>
        <label>
          Badge label (optional)
          <input
            name="badge"
            type="text"
            value={badgeValue}
            onChange={e => setBadgeValue(e.target.value)}
            maxLength={30}
            placeholder="e.g. Popular, New, Bestseller"
          />
          <div className="admin-badge-presets">
            {BADGE_PRESETS.map(preset => (
              <button key={preset} type="button" className="admin-badge-preset" onClick={() => setBadgeValue(preset)}>
                {preset}
              </button>
            ))}
            {badgeValue && <button type="button" className="admin-badge-preset" onClick={() => setBadgeValue('')}>Clear</button>}
          </div>
        </label>

        {(clientError || error) && <p className="admin-error-banner" role="alert">{clientError || error}</p>}

        <div className="admin-modal-actions">
          <button type="button" className="admin-btn-secondary" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className="admin-btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}</button>
        </div>
      </form>
    </section>
  </div>;
}

function DeleteProductDialog({ product, busy, error, onConfirm, onCancel }) {
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return <div className="admin-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
    <section className="admin-modal admin-modal-small" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
      <div className="admin-modal-head">
        <h2 id="delete-product-title">Delete product?</h2>
        <button type="button" className="admin-modal-close" onClick={onCancel} disabled={busy} aria-label="Close confirmation">×</button>
      </div>
      <p className="admin-muted-note">
        Are you sure you want to remove <strong>{product.name}</strong> from the live store catalog? This action cannot be undone.
      </p>
      {error && <p className="admin-error-banner" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      <div className="admin-modal-actions" style={{ marginTop: 20 }}>
        <button type="button" className="admin-btn-secondary" disabled={busy} onClick={onCancel}>Keep product</button>
        <button type="button" className="admin-btn-danger admin-btn-danger-solid" disabled={busy} onClick={onConfirm}>
          {busy ? 'Deleting…' : 'Delete product'}
        </button>
      </div>
    </section>
  </div>;
}

function ProductsSection({
  products,
  loading,
  categoryFilter,
  onCategoryFilterChange,
  onOpenAdd,
  onOpenEdit,
  onRequestDelete,
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');

  const countForCategory = category => (
    category === 'All' ? products.length : products.filter(p => p.category === category).length
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter(p => (
      (categoryFilter === 'All' || p.category === categoryFilter)
      && (!q || `${p.name} ${p.description} ${p.badge || ''} ${p.category}`.toLowerCase().includes(q))
    ));
    const sorted = [...list];
    if (sort === 'low') sorted.sort((a, b) => a.price - b.price);
    else if (sort === 'high') sorted.sort((a, b) => b.price - a.price);
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, categoryFilter, search, sort]);

  return <>
    <div className="admin-toolbar">
      <div className="admin-filter-pills" role="tablist" aria-label="Filter catalog by category">
        {['All', ...categories].map(category => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={categoryFilter === category}
            className={`admin-pill ${categoryFilter === category ? 'selected' : ''}`}
            onClick={() => onCategoryFilterChange(category)}
          >
            {category} <span>{countForCategory(category)}</span>
          </button>
        ))}
      </div>
      <div className="admin-controls-right">
        <label className="admin-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search catalog…"
            aria-label="Search catalog products"
          />
        </label>
        <select className="admin-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort catalog products">
          <option value="default">Sort: Catalog order</option>
          <option value="name">Name: A to Z</option>
          <option value="low">Price: Low to high</option>
          <option value="high">Price: High to low</option>
        </select>
        <button type="button" className="admin-btn-primary" onClick={onOpenAdd}>+ Add product</button>
      </div>
    </div>

    {loading && !products.length ? (
      <div className="admin-empty-box" role="status">Loading product catalog…</div>
    ) : !filteredProducts.length ? (
      <div className="admin-empty-box">
        {search || categoryFilter !== 'All' ? 'No products match your filters.' : 'Your catalog has no products yet. Add your first product to get started.'}
      </div>
    ) : (
      <div className="admin-catalog-table-wrap">
        {filteredProducts.map(product => (
          <article className="admin-catalog-row" key={product._id}>
            <div className="admin-catalog-thumb">
              <ProductThumb src={product.image} alt={product.name} />
            </div>
            <div className="admin-catalog-info">
              <div className="admin-catalog-title-row">
                <strong>{product.name}</strong>
                {product.badge && <span className="admin-product-badge">{product.badge}</span>}
              </div>
              <p>{product.description}</p>
            </div>
            <span className="admin-category-chip">{product.category}</span>
            <strong className="admin-catalog-price">{money(product.price)}</strong>
            <div className="admin-row-actions">
              <button type="button" className="admin-btn-secondary" onClick={() => onOpenEdit(product)}>Edit</button>
              <button type="button" className="admin-btn-danger" onClick={() => onRequestDelete(product)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    )}
  </>;
}

export default function AdminPage({ initialTab = 'overview', session }) {
  const [tab, setTab] = useState(TAB_META[initialTab] ? initialTab : 'overview');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lastSynced, setLastSynced] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [historyState, setHistoryState] = useState({ items: [], loading: false, error: '' });
  const [statusNote, setStatusNote] = useState('');
  const [orderActionBusy, setOrderActionBusy] = useState(false);
  const [orderActionError, setOrderActionError] = useState('');

  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [productModal, setProductModal] = useState({ open: false, editing: null });
  const [productBusy, setProductBusy] = useState(false);
  const [productError, setProductError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const historyRequestId = useRef(0);

  useEffect(() => {
    document.title = `${TAB_META[tab].title} — Admin · Sean & JC.co`;
  }, [tab]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/\/$/, '') || '/';
      const matched = Object.entries(TAB_META).find(([, meta]) => meta.path === path);
      if (matched) setTab(matched[0]);
    };
    const handleExpired = event => {
      if (event.detail?.role === 'admin' || !event.detail?.role) {
        window.location.replace('/admin/login');
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener(authExpiredEvent, handleExpired);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener(authExpiredEvent, handleExpired);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  async function refreshAll(silent = false) {
    if (!silent) {
      setLoading(true);
      setLoadError('');
    }
    try {
      const [fetchedProducts, fetchedOrders] = await Promise.all([
        api('/products'),
        api('/orders', { requiresAuth: 'admin' }),
      ]);
      setProducts(Array.isArray(fetchedProducts) ? fetchedProducts : []);
      const normalizedOrders = Array.isArray(fetchedOrders) ? fetchedOrders : [];
      setOrders(normalizedOrders);
      setSelectedOrderId(previous => (
        previous && normalizedOrders.some(o => o._id === previous)
          ? previous
          : normalizedOrders[0]?._id || null
      ));
      setLastSynced(new Date());
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Could not load admin data.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function loadOrderHistory(orderId) {
    if (!orderId) {
      setHistoryState({ items: [], loading: false, error: '' });
      return;
    }
    const requestToken = ++historyRequestId.current;
    setHistoryState(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const entries = await api(`/orders/${orderId}/history`, { requiresAuth: 'admin' });
      if (requestToken === historyRequestId.current) {
        setHistoryState({ items: Array.isArray(entries) ? entries : [], loading: false, error: '' });
      }
    } catch (error) {
      if (requestToken === historyRequestId.current) {
        setHistoryState({ items: [], loading: false, error: error.message || 'Could not load order history.' });
      }
    }
  }

  useEffect(() => {
    if (tab !== 'orders' || !selectedOrderId) return;
    setOrderActionError('');
    setStatusNote('');
    loadOrderHistory(selectedOrderId);
  }, [tab, selectedOrderId]);

  function switchTab(nextTab) {
    setTab(nextTab);
    const targetPath = TAB_META[nextTab]?.path || '/admin';
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }

  function handleLogout() {
    try {
      clearAuthSession();
    } catch {
      // Proceed to login even if localStorage removal threw.
    }
    window.location.assign('/admin/login');
  }

  async function handleTransitionStatus(orderId, targetStatus) {
    setOrderActionBusy(true);
    setOrderActionError('');
    try {
      const trimmedNote = statusNote.trim();
      const updated = await api(`/orders/${orderId}/status`, {
        method: 'PATCH',
        requiresAuth: 'admin',
        body: {
          status: targetStatus,
          ...(trimmedNote ? { note: trimmedNote } : {}),
        },
      });
      setOrders(prev => prev.map(order => (
        order._id === orderId ? { ...order, status: updated.status } : order
      )));
      setStatusNote('');
      setToastMessage(`Order status updated to ${updated.status}`);
      await Promise.all([refreshAll(true), loadOrderHistory(orderId)]);
    } catch (error) {
      setOrderActionError(error.message || 'Could not update order status.');
      await Promise.all([refreshAll(true), loadOrderHistory(orderId)]);
    } finally {
      setOrderActionBusy(false);
    }
  }

  async function handleUpdatePayment(orderId, paymentStatus) {
    setOrderActionBusy(true);
    setOrderActionError('');
    try {
      const updated = await api(`/orders/${orderId}/payment`, {
        method: 'PATCH',
        requiresAuth: 'admin',
        body: { paymentStatus },
      });
      setOrders(prev => prev.map(order => (
        order._id === orderId ? { ...order, paymentStatus: updated.paymentStatus } : order
      )));
      setToastMessage(`Payment status updated to ${updated.paymentStatus}`);
      await refreshAll(true);
    } catch (error) {
      setOrderActionError(error.message || 'Could not update payment status.');
      await refreshAll(true);
    } finally {
      setOrderActionBusy(false);
    }
  }

  async function handleSaveProduct(payload) {
    const editing = productModal.editing;
    setProductBusy(true);
    setProductError('');
    try {
      const saved = await api(`/products${editing ? `/${editing._id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        requiresAuth: 'admin',
        body: payload,
      });
      setProducts(prev => (
        editing
          ? prev.map(item => (item._id === saved._id ? saved : item))
          : [...prev, saved]
      ));
      setLastSynced(new Date());
      setProductModal({ open: false, editing: null });
      setToastMessage(editing ? 'Product updated in live catalog' : 'Product added to live catalog');
    } catch (error) {
      setProductError(error.message || 'Could not save product.');
    } finally {
      setProductBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const targetId = deleteTarget._id;
    setProductBusy(true);
    setDeleteError('');
    try {
      await api(`/products/${targetId}`, { method: 'DELETE', requiresAuth: 'admin' });
      setProducts(prev => prev.filter(item => item._id !== targetId));
      try {
        const rawCart = localStorage.getItem('ff-mern-cart');
        if (rawCart) {
          const parsed = JSON.parse(rawCart);
          if (parsed && typeof parsed === 'object' && targetId in parsed) {
            delete parsed[targetId];
            localStorage.setItem('ff-mern-cart', JSON.stringify(parsed));
          }
        }
      } catch {
        // Ignore storage errors if cart storage is restricted.
      }
      setLastSynced(new Date());
      setDeleteTarget(null);
      setToastMessage('Product removed from live catalog');
    } catch (error) {
      setDeleteError(error.message || 'Could not delete product.');
    } finally {
      setProductBusy(false);
    }
  }

  const pendingAttentionCount = orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
  const activeMeta = TAB_META[tab];

  return <div className="admin-shell">
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        <a href="/" className="brand">Sean <span>&amp;</span> JC.co</a>
        <span className="admin-badge">Admin</span>
      </div>
      <nav className="admin-tabs" aria-label="Admin sections">
        <button
          type="button"
          className={`admin-tab ${tab === 'overview' ? 'active' : ''}`}
          aria-current={tab === 'overview' ? 'page' : undefined}
          onClick={() => switchTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'orders' ? 'active' : ''}`}
          aria-current={tab === 'orders' ? 'page' : undefined}
          onClick={() => switchTab('orders')}
        >
          Orders <span className="admin-tab-count">{pendingAttentionCount}</span>
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'products' ? 'active' : ''}`}
          aria-current={tab === 'products' ? 'page' : undefined}
          onClick={() => switchTab('products')}
        >
          Products <span className="admin-tab-count">{products.length}</span>
        </button>
      </nav>
      <div className="admin-topbar-actions">
        <span className="admin-user-chip">{session?.user?.name || session?.user?.email}</span>
        <a href="/" className="admin-store-link">View store ↗</a>
        <button type="button" className="admin-signout-btn" onClick={handleLogout}>Sign out</button>
      </div>
    </header>

    <main className="admin-main">
      <div className="admin-hero-bar">
        <div>
          <div className="eyebrow">STORE ADMINISTRATION</div>
          <h1>{activeMeta.title}</h1>
          <p className="admin-hero-subtitle">{activeMeta.subtitle}</p>
        </div>
        <div className="admin-sync-controls">
          {lastSynced && (
            <span className="admin-sync-time">
              <span className="live-dot" /> Synced {lastSynced.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <button type="button" className="admin-btn-secondary" disabled={loading} onClick={() => refreshAll()}>
            {loading ? 'Refreshing…' : 'Refresh data'}
          </button>
          {tab === 'products' && (
            <button
              type="button"
              className="admin-btn-primary"
              onClick={() => { setProductError(''); setProductModal({ open: true, editing: null }); }}
            >
              + Add product
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="admin-error-banner" role="alert">
          <span>{loadError}</span>
          <button type="button" className="admin-btn-secondary" onClick={() => refreshAll()}>Retry</button>
        </div>
      )}

      {tab === 'overview' && (
        <OverviewSection
          products={products}
          orders={orders}
          onSelectTab={switchTab}
          onInspectOrder={id => {
            setSelectedOrderId(id);
            switchTab('orders');
          }}
          onSelectCategory={category => {
            setProductCategoryFilter(category);
            switchTab('products');
          }}
          onAddProduct={() => {
            setProductError('');
            setProductModal({ open: true, editing: null });
          }}
        />
      )}

      {tab === 'orders' && (
        <OrdersSection
          orders={orders}
          loading={loading}
          selectedOrderId={selectedOrderId}
          onSelectOrder={setSelectedOrderId}
          historyState={historyState}
          onReloadHistory={loadOrderHistory}
          onTransitionStatus={handleTransitionStatus}
          onUpdatePayment={handleUpdatePayment}
          actionBusy={orderActionBusy}
          actionError={orderActionError}
          statusNote={statusNote}
          onStatusNoteChange={setStatusNote}
        />
      )}

      {tab === 'products' && (
        <ProductsSection
          products={products}
          loading={loading}
          categoryFilter={productCategoryFilter}
          onCategoryFilterChange={setProductCategoryFilter}
          onOpenAdd={() => { setProductError(''); setProductModal({ open: true, editing: null }); }}
          onOpenEdit={product => { setProductError(''); setProductModal({ open: true, editing: product }); }}
          onRequestDelete={product => { setDeleteError(''); setDeleteTarget(product); }}
        />
      )}
    </main>

    <footer className="admin-footer">
      <span>Sean &amp; JC.co · Store Administration</span>
      <span>Signed in as {session?.user?.email}</span>
    </footer>

    {productModal.open && (
      <ProductFormModal
        editing={productModal.editing}
        busy={productBusy}
        error={productError}
        defaultCategory={productCategoryFilter !== 'All' ? productCategoryFilter : categories[0]}
        onSave={handleSaveProduct}
        onClose={() => setProductModal({ open: false, editing: null })}
      />
    )}

    {deleteTarget && (
      <DeleteProductDialog
        product={deleteTarget}
        busy={productBusy}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    )}

    <div id="toast" className={toastMessage ? 'visible' : ''} role="status">{toastMessage}</div>
  </div>;
}
