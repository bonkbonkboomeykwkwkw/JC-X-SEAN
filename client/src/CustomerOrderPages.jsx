import { useState } from 'react';
import ShoppingBagIcon from './ShoppingBagIcon';
import './customer-order-pages.css';

const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
const statuses = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const progress = ['Pending', 'Processing', 'Shipped', 'Delivered'];

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
    <p className="order-shipping-caption">Shipping estimate: $8 under $100; free at $100 and over.</p>
  </aside>;
}

export function CheckoutPage({ items, subtotal, onPlaceOrder, onBack }) {
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [error, setError] = useState('');
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

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const { payment: _payment, ...customer } = Object.fromEntries(new FormData(form));
    setError('');
    onPlaceOrder({ customer, paymentMethod, orderItems, subtotal, shipping, total });
  }

  return <section className="customer-page checkout-page" aria-labelledby="checkout-title">
    <button className="customer-back" onClick={onBack}>← Back to cart</button>
    <div className="customer-page-heading"><div className="eyebrow">ALMOST YOURS</div><h1 id="checkout-title">Checkout</h1><p>Enter your delivery details to review this order.</p></div>
    {!items.length ? <div className="order-empty"><ShoppingBagIcon size={38} /><h2>Your cart is empty.</h2><p>Add something to your bag before checking out.</p><button className="dark-button" onClick={onBack}>Return to cart</button></div> : <div className="checkout-layout">
      <form className="checkout-form" onSubmit={submit}>
        <fieldset className="checkout-fieldset">
          <legend><span>01</span> Customer information</legend>
          <label>Full name<input name="name" autoComplete="name" required maxLength={100} /></label>
          <div className="checkout-field-row"><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label><label>Contact number<input name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={20} /></label></div>
        </fieldset>
        <fieldset className="checkout-fieldset">
          <legend><span>02</span> Delivery information</legend>
          <label>Complete delivery address<input name="address" autoComplete="street-address" required maxLength={250} /></label>
          <div className="checkout-field-row checkout-location-row"><label>City / Municipality<input name="city" autoComplete="address-level2" required maxLength={100} /></label><label>Province<input name="province" autoComplete="address-level1" required maxLength={100} /></label><label>Postal code<input name="postalCode" autoComplete="postal-code" required maxLength={12} /></label></div>
          <label>Delivery instructions <span className="optional-label">Optional</span><textarea name="instructions" rows="3" maxLength={300} placeholder="Anything the courier should know?" /></label>
        </fieldset>
        <fieldset className="checkout-fieldset payment-fieldset">
          <legend><span>03</span> Payment method</legend>
          <label className="payment-option"><input type="radio" name="payment" value="Cash on Delivery" checked={paymentMethod === 'Cash on Delivery'} onChange={event => setPaymentMethod(event.target.value)} /><span><strong>Cash on Delivery</strong><small>Pay when your order arrives</small></span></label>
          <label className="payment-option"><input type="radio" name="payment" value="GCash" checked={paymentMethod === 'GCash'} onChange={event => setPaymentMethod(event.target.value)} /><span><strong>GCash</strong><small>Preview only; payment is not processed</small></span></label>
          <label className="payment-option"><input type="radio" name="payment" value="Credit / Debit Card" checked={paymentMethod === 'Credit / Debit Card'} onChange={event => setPaymentMethod(event.target.value)} /><span><strong>Credit / Debit Card</strong><small>Preview only; no card details requested</small></span></label>
        </fieldset>
        {error && <p className="checkout-error" role="alert">{error}</p>}
        <button className="dark-button checkout-place-order" type="submit">Place order <span>↗</span></button>
        <p className="checkout-preview-note">Frontend preview only. Submitting creates a temporary order in this page session; no payment or server record is created.</p>
      </form>
      <Summary orderItems={orderItems} subtotal={subtotal} shipping={shipping} total={total} />
    </div>}
  </section>;
}

export function MyOrdersPage({ orders, onViewDetails }) {
  const [filter, setFilter] = useState('All');
  const filteredOrders = filter === 'All' ? orders : orders.filter(order => order.status === filter);

  return <section className="customer-page orders-page" aria-labelledby="orders-title">
    <div className="customer-page-heading"><div className="eyebrow">YOUR ACCOUNT</div><h1 id="orders-title">My orders</h1><p>Keep track of your recent purchases.</p></div>
    <div className="order-filters" role="tablist" aria-label="Filter orders by status">{statuses.map(status => <button key={status} role="tab" aria-selected={filter === status} className={filter === status ? 'selected' : ''} onClick={() => setFilter(status)}>{status}</button>)}</div>
    {!filteredOrders.length ? <div className="order-empty"><ShoppingBagIcon size={38} /><h2>No {filter === 'All' ? '' : `${filter.toLowerCase()} `}orders here.</h2><p>Your orders will appear here after you place one.</p></div> : <div className="orders-list">{filteredOrders.map(order => <article className="order-card" key={order.id}>
      <div className="order-card-top"><div><span className="order-meta-label">ORDER</span><strong>{order.id}</strong></div><span className={`order-status status-${order.status.toLowerCase()}`}>{order.status}</span></div>
      <div className="order-card-middle"><div className="order-preview-images">{order.items.slice(0, 3).map((item, index) => <OrderImage key={`${item.id}-${index}`} item={item} />)}</div><div className="order-card-description"><strong>{order.items.length === 1 ? order.items[0].name : `${order.items[0]?.name || 'Order'}${order.items.length > 1 ? ` + ${order.items.length - 1} more` : ''}`}</strong><span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} {order.items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'} · {new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span></div><strong className="order-card-total">{money(order.total)}</strong></div>
      <div className="order-card-bottom"><span>{order.paymentMethod}</span><button className="small-button" onClick={() => onViewDetails(order.id)}>View details ↗</button></div>
    </article>)}</div>}
  </section>;
}

export function OrderDetailsPage({ order, justPlaced, onBack, onCancel }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (!order) return <section className="customer-page order-empty"><h2>Order not found.</h2><button className="dark-button" onClick={onBack}>Back to my orders</button></section>;
  const currentStep = progress.indexOf(order.status);
  const canCancel = order.status === 'Pending';

  return <section className="customer-page order-details-page" aria-labelledby="order-details-title">
    <button className="customer-back" onClick={onBack}>← Back to my orders</button>
    {justPlaced && <p className="order-confirmation" role="status">Order placed in preview mode. No payment or server record was created.</p>}
    <div className="order-details-heading"><div><div className="eyebrow">ORDER DETAILS</div><h1 id="order-details-title">{order.id}</h1><p>Placed {new Date(order.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><span className={`order-status status-${order.status.toLowerCase()}`}>{order.status}</span></div>
    <div className="order-progress" aria-label={`Order progress: ${order.status}`}>
      {progress.map((step, index) => <div className={`order-progress-step ${order.status === 'Cancelled' ? index === 0 ? 'cancelled-step' : '' : index <= currentStep ? 'complete' : ''}`} key={step}><span className="progress-marker">{order.status === 'Cancelled' && index === 0 ? '×' : index < currentStep ? '✓' : index + 1}</span><span>{step}</span></div>)}
      {order.status === 'Cancelled' && <p className="cancelled-caption">This order was cancelled.</p>}
    </div>
    <div className="order-details-grid">
      <div className="order-detail-main">
        <section className="order-detail-section"><h2>Items ordered</h2>{order.items.map((item, index) => <article className="order-detail-item" key={`${item.id}-${index}`}><OrderImage item={item} /><div><strong>{item.name}</strong><span>{item.category}</span><small>{money(item.price)} × {item.quantity}</small></div><strong>{money(item.price * item.quantity)}</strong></article>)}</section>
        <section className="order-detail-section"><h2>Delivery information</h2><div className="order-customer-info"><strong>{order.customer.name}</strong><span>{order.customer.email}</span><span>{order.customer.phone}</span><span>{order.customer.address}, {order.customer.city}, {order.customer.province} {order.customer.postalCode}</span>{order.customer.instructions && <p>Note: {order.customer.instructions}</p>}</div></section>
      </div>
      <aside className="order-detail-side">
        <section className="order-detail-section"><h2>Payment</h2><div className="order-payment-info"><span>{order.paymentMethod}</span><span>Payment status: <strong>{order.paymentStatus}</strong></span></div></section>
        <section className="order-detail-section order-totals"><h2>Order total</h2><div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div><div><span>Shipping</span><strong>{order.shipping ? money(order.shipping) : 'Free'}</strong></div><div className="order-total-final"><span>Total</span><strong>{money(order.total)}</strong></div></section>
        {canCancel && <button className="cancel-order-button" onClick={() => setConfirmCancel(true)}>Cancel order</button>}
      </aside>
    </div>
    {confirmCancel && <div className="cancel-dialog-backdrop"><section className="cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title"><h2 id="cancel-dialog-title">Cancel this order?</h2><p>This preview order will be marked as cancelled.</p><div><button className="cancel-keep-button" onClick={() => setConfirmCancel(false)}>Keep order</button><button className="cancel-confirm-button" onClick={() => { onCancel(order.id); setConfirmCancel(false); }}>Yes, cancel order</button></div></section></div>}
  </section>;
}
