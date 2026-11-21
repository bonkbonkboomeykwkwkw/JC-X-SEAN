import { useRef, useState } from 'react';
import ShoppingBagIcon from './ShoppingBagIcon';
import './customer-order-pages.css';

const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

function formatOrderDate(value, options) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-US', options);
}

function OrderImage({ item, className = '' }) {
  const [failed, setFailed] = useState(false);
  return item.image && !failed
    ? <img className={className} src={item.image} alt={item.name} onError={() => setFailed(true)} />
    : <span className={`${className} order-image-fallback`} role="img" aria-label={`${item.name} image unavailable`}>Image unavailable</span>;
}

function Summary({ orderItems, subtotal, shipping, total }) {
  return <aside className="order-summary" aria-labelledby="checkout-summary-heading">
    <h2 id="checkout-summary-heading">Order summary</h2>
    <div className="order-summary-items">{orderItems.map(item => <div className="order-summary-item" key={item.id}>
      <OrderImage item={item} />
      <span>{item.name} <small>× {item.quantity}</small></span>
      <strong>{money(item.price * item.quantity)}</strong>
    </div>)}</div>
    <div className="order-summary-line"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
    <div className="order-summary-line"><span>Shipping</span><strong>{shipping ? money(shipping) : 'Free'}</strong></div>
    <div className="order-summary-total"><span>Estimated total</span><strong>{money(total)}</strong></div>
    <p className="order-shipping-caption">Shipping estimate: ₱8 under ₱100; free at ₱100 and over.</p>
  </aside>;
}

export function CheckoutPage({ items, subtotal, onPlaceOrder, onBack, onViewOrders, onContinueShopping }) {
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const submissionLock = useRef(false);
  const formRef = useRef(null);
  const shipping = subtotal >= 100 ? 0 : 8;
  const total = subtotal + shipping;
  const orderItems = items.map(({ product, quantity }) => ({
    id: product._id,
    name: product.name,
    image: product.image,
    category: product.category,
    price: product.price,
    quantity,
  }));

  function readForm(form) {
    const values = Object.fromEntries(new FormData(form));
    const address = [values.address, values.city, values.province, values.postalCode]
      .map(value => value.trim())
      .filter(Boolean)
      .join(', ');
    return {
      customer: { name: values.name.trim(), email: values.email.trim(), address },
    };
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (submissionLock.current || !form.reportValidity()) return;
    const { customer } = readForm(form);
    if (!customer.address || customer.address.length > 500) {
      setError('Enter a delivery address the order API can accept (up to 500 characters).');
      return;
    }
    setError('');
    submissionLock.current = true;
    setSubmitting(true);
    try {
      const order = await onPlaceOrder({ customer });
      setConfirmation({ order });
    } catch (requestError) {
      setError(requestError.message || 'The order could not be saved. Your cart has been kept.');
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  if (confirmation) return <section className="customer-page checkout-page checkout-confirmation-page" aria-labelledby="checkout-confirmation-title">
    <div className="checkout-success-card">
      <div className="checkout-success-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="m6.5 12.5 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div className="eyebrow">ORDER CONFIRMED</div>
      <h1 id="checkout-confirmation-title">Order Placed Successfully!</h1>
      <p className="checkout-success-message">Thanks for shopping with Sean &amp; JC.co. We’ve received your order and will begin processing it shortly.</p>
      <div className="checkout-order-reference">
        <span>ORDER REFERENCE</span>
        <strong>{confirmation.order.id}</strong>
      </div>
      <div className="checkout-confirmation-summary">
        <div><span>Current status</span><strong>{confirmation.order.status}</strong></div>
        <div><span>Order total</span><strong>{money(confirmation.order.total)}</strong></div>
      </div>
      <div className="checkout-confirmation-actions">
        <button className="dark-button" type="button" onClick={onViewOrders}>View My Orders <span>↗</span></button>
        <button className="checkout-secondary-button" type="button" onClick={onContinueShopping}>Continue Shopping</button>
      </div>
      <p className="checkout-success-footnote">Your order details are saved to your account. No payment was processed online.</p>
    </div>
  </section>;

  return <section className="customer-page checkout-page" aria-labelledby="checkout-title">
    <button className="customer-back" disabled={submitting} onClick={onBack}>← Back to cart</button>
    <div className="customer-page-heading"><div className="eyebrow">ALMOST YOURS</div><h1 id="checkout-title">Checkout</h1><p>Enter your delivery details to review this order.</p></div>
    {!items.length ? <div className="order-empty"><ShoppingBagIcon size={38} /><h2>Your cart is empty.</h2><p>Add something to your bag before checking out.</p><button className="dark-button" onClick={onBack}>Return to cart</button></div> : <div className="checkout-layout">
      <form ref={formRef} className="checkout-form" onSubmit={submit}>
        <fieldset className="checkout-fieldset" disabled={submitting}>
          <legend><span>01</span> Customer information</legend>
          <label>Full name<input name="name" autoComplete="name" required maxLength={100} /></label>
          <div className="checkout-field-row"><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label><label>Contact number<input name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={20} /></label></div>
        </fieldset>
        <fieldset className="checkout-fieldset" disabled={submitting}>
          <legend><span>02</span> Delivery information</legend>
          <label>Complete delivery address<input name="address" autoComplete="street-address" required maxLength={250} /></label>
          <div className="checkout-field-row checkout-location-row"><label>City / Municipality<input name="city" autoComplete="address-level2" required maxLength={100} /></label><label>Province<input name="province" autoComplete="address-level1" required maxLength={100} /></label><label>Postal code<input name="postalCode" autoComplete="postal-code" required maxLength={12} /></label></div>
          <label>Delivery instructions <span className="optional-label">Optional</span><textarea name="instructions" rows="3" maxLength={300} placeholder="Anything the courier should know?" /></label>
        </fieldset>
        <fieldset className="checkout-fieldset payment-fieldset" disabled={submitting}>
          <legend><span>03</span> Payment method</legend>
          <label className="payment-option"><input type="radio" name="payment" value="Cash on Delivery" checked={paymentMethod === 'Cash on Delivery'} onChange={event => setPaymentMethod(event.target.value)} /><span><strong>Cash on Delivery</strong><small>Pay when your order arrives</small></span></label>
          <label className="payment-option"><input type="radio" name="payment" value="GCash" checked={paymentMethod === 'GCash'} onChange={event => setPaymentMethod(event.target.value)} /><span><strong>GCash</strong><small>Preview only; payment is not processed</small></span></label>
          <label className="payment-option"><input type="radio" name="payment" value="Credit / Debit Card" checked={paymentMethod === 'Credit / Debit Card'} onChange={event => setPaymentMethod(event.target.value)} /><span><strong>Credit / Debit Card</strong><small>Preview only; no card details requested</small></span></label>
        </fieldset>
        {error && <p className="checkout-error" role="alert">{error}</p>}
        <button className="dark-button checkout-place-order" type="submit" disabled={submitting}>{submitting ? 'Saving order…' : 'Place order'} <span>↗</span></button>
        <p className="checkout-preview-note">The order API stores your name, email, one combined delivery address, and items. It does not store your contact number, delivery instructions, or payment method. No payment is processed.</p>
      </form>
      <Summary orderItems={orderItems} subtotal={subtotal} shipping={shipping} total={total} />
    </div>}
  </section>;
}

export function MyOrdersPage({ orders, loading, error, onRefresh, onViewDetails }) {
  const [filter, setFilter] = useState('All');
  const statuses = ['All', ...new Set(orders.map(order => order.status).filter(status => typeof status === 'string' && status))];
  const activeFilter = statuses.includes(filter) ? filter : 'All';
  const filteredOrders = activeFilter === 'All' ? orders : orders.filter(order => order.status === activeFilter);

  return <section className="customer-page orders-page" aria-labelledby="orders-title">
    <div className="customer-page-heading"><div className="eyebrow">YOUR ACCOUNT</div><h1 id="orders-title">My orders</h1><p>Keep track of your recent purchases.</p></div>
    <button className="small-button" type="button" onClick={onRefresh} disabled={loading}>Refresh orders</button>
    {loading ? <div className="order-empty" role="status"><p>Loading orders…</p></div> : error ? <div className="order-empty" role="alert"><h2>Could not load orders.</h2><p>{error}</p><button className="small-button" type="button" onClick={onRefresh}>Try again</button></div> : !orders.length ? <div className="order-empty"><ShoppingBagIcon size={38} /><h2>No orders found.</h2><p>Orders saved by the store will appear here.</p></div> : <>
    <div className="order-filters" role="tablist" aria-label="Filter orders by status">{statuses.map(status => <button key={status} role="tab" aria-selected={activeFilter === status} className={activeFilter === status ? 'selected' : ''} onClick={() => setFilter(status)}>{status}</button>)}</div>
    {!filteredOrders.length ? <div className="order-empty"><h2>No {activeFilter.toLowerCase()} orders.</h2></div> : <div className="orders-list">{filteredOrders.map(order => {
      const items = Array.isArray(order.items) ? order.items : [];
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      const itemSummary = items.map(item => `${item.name} × ${item.quantity}`).join(', ');
      const status = typeof order.status === 'string' && order.status ? order.status : 'Status not provided';
      return <article className="order-card" key={order._id}>
        <div className="order-card-top"><div><span className="order-meta-label">ORDER</span><strong>{order._id}</strong></div><span className={`order-status status-${status.toLowerCase()}`}>{status}</span></div>
        <div className="order-card-middle"><div className="order-card-description"><strong>{itemSummary || 'No item details returned'}</strong><span>{itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatOrderDate(order.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}</span></div><strong className="order-card-total">{money(order.total)}</strong></div>
        <div className="order-card-bottom"><span>Order total</span><button className="small-button" onClick={() => onViewDetails(order._id)}>View details ↗</button></div>
      </article>;
    })}</div>}
    </>}
  </section>;
}

export function OrderDetailsPage({ order, onBack }) {
  if (!order) return <section className="customer-page order-empty"><h2>Order not found.</h2><button className="dark-button" onClick={onBack}>Back to my orders</button></section>;
  const items = Array.isArray(order.items) ? order.items : [];
  const status = typeof order.status === 'string' && order.status ? order.status : 'Status not provided';

  return <section className="customer-page order-details-page" aria-labelledby="order-details-title">
    <button className="customer-back" onClick={onBack}>← Back to my orders</button>
    <div className="order-details-heading"><div><div className="eyebrow">ORDER DETAILS</div><h1 id="order-details-title">{order._id}</h1><p>Placed {formatOrderDate(order.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</p></div><span className={`order-status status-${status.toLowerCase()}`}>{status}</span></div>
    <div className="order-details-grid">
      <div className="order-detail-main">
        <section className="order-detail-section"><h2>Items ordered</h2>{items.length ? items.map((item, index) => <article className="order-detail-item" key={`${item.product}-${index}`}><span className="order-image-fallback" aria-hidden="true">No image</span><div><strong>{item.name}</strong><small>{money(item.price)} × {item.quantity}</small></div><strong>{money(item.price * item.quantity)}</strong></article>) : <p>No item details were returned for this order.</p>}</section>
      </div>
      <aside className="order-detail-side">
        <section className="order-detail-section order-totals"><h2>Order total</h2><div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div><div><span>Shipping</span><strong>{order.shipping ? money(order.shipping) : 'Free'}</strong></div><div className="order-total-final"><span>Total</span><strong>{money(order.total)}</strong></div></section>
      </aside>
    </div>
  </section>;
}
