import ShoppingBagIcon from './ShoppingBagIcon';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import StoreHeader from './StoreHeader';
import AuthPages from './AuthPages';
import ProductDetails from './ProductDetails';
import CartPage from './CartPage';
import { CheckoutPage, MyOrdersPage, OrderDetailsPage } from './CustomerOrderPages';
import { api, authExpiredEvent, clearAuthSession, readAuthState } from './api';
import './style.css';
import { categories, categoryPages, categoryPath, categoryFromPath } from '../../shared/categories.js';
const page = categoryFromPath(window.location.pathname);
const isHome = window.location.pathname === '/';
const authPage = ({ '/register': 'register', '/login': 'login', '/admin/login': 'admin' })[window.location.pathname];
const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
const liveRefreshMs = 15000;
function Dialog({ title, children, close, wide }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className={wide ? 'wide-dialog' : ''} onCancel={close}><div className="dialog-heading"><h2>{title}</h2><button className="close" onClick={close} aria-label="Close dialog">×</button></div>{children}</dialog>;
}
function App() {
  const [initialAuthState] = useState(() => readAuthState());
  const [authSession, setAuthSession] = useState(initialAuthState.session);
  const [products, setProducts] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState(null);
  const category = page?.name || 'All products';
  const [search, setSearch] = useState(''), [sort, setSort] = useState('featured');
  const [modal, setModal] = useState(null), [editing, setEditing] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCartPage, setShowCartPage] = useState(false);
  const [customerPage, setCustomerPage] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [ordersRefresh, setOrdersRefresh] = useState(0);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [cart, setCart] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('ff-mern-cart')); return saved && typeof saved === 'object' && !Array.isArray(saved) ? Object.fromEntries(Object.entries(saved).filter(([, q]) => Number.isInteger(q) && q > 0 && q <= 99)) : {}; } catch { return {}; } });
  const [formError, setFormError] = useState('');
  useEffect(() => {
    if (initialAuthState.expiredRole) {
      window.location.replace(initialAuthState.expiredRole === 'admin' ? '/admin/login' : '/login');
      return;
    }
    const handleExpiredSession = event => {
      setAuthSession(null);
      setModal(null);
      setCustomerPage(null);
      setShowCartPage(false);
      const loginPath = event.detail?.role === 'admin' ? '/admin/login' : '/login';
      if (window.location.pathname !== loginPath) window.location.assign(loginPath);
    };
    window.addEventListener(authExpiredEvent, handleExpiredSession);
    return () => window.removeEventListener(authExpiredEvent, handleExpiredSession);
  }, []);
  async function load(silent = false) {
    if (!silent) { setLoading(true); setError(''); }
    try { setProducts(await api('/products')); setLastSynced(new Date()); }
    catch (e) { if (!silent) setError(e.message); }
    finally { if (!silent) setLoading(false); }
  }
  useEffect(() => {
    load();
    document.title = `${page ? page.name : isHome ? 'Gadgets for everyday life' : 'Page not found'} — Sean & JC.co`;
    const refresh = () => load(true);
    const timer = window.setInterval(refresh, liveRefreshMs);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    if (customerPage !== 'orders') return;
    let active = true;
    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError('');
      try {
        const result = await api('/orders', { requiresAuth: 'customer' });
        if (!Array.isArray(result)) throw new Error('The orders API returned an unexpected response.');
        if (active) setOrders(result);
      } catch (e) {
        if (active) setOrdersError(e.message);
      } finally {
        if (active) setOrdersLoading(false);
      }
    }
    loadOrders();
    return () => { active = false; };
  }, [customerPage, ordersRefresh]);
  useEffect(() => { try { localStorage.setItem('ff-mern-cart', JSON.stringify(cart)); } catch { /* Cart still works for this visit. */ } }, [cart]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 4000); return () => clearTimeout(timer); }, [message]);
  const cartProducts = products.filter(p => cart[p._id]);
  const count = cartProducts.reduce((sum, p) => sum + cart[p._id], 0);
  const subtotal = cartProducts.reduce((sum, p) => sum + Math.round(p.price * 100) * cart[p._id], 0) / 100;
  const shipping = subtotal >= 100 ? 0 : 8;
  let shown = products.filter(p => (category === 'All products' || p.category === category) && `${p.name} ${p.description}`.toLowerCase().includes(search.trim().toLowerCase()));
  if (sort === 'low') shown.sort((a, b) => a.price - b.price);
  if (sort === 'high') shown.sort((a, b) => b.price - a.price);
  if (sort === 'name') shown.sort((a, b) => a.name.localeCompare(b.name));
  function changeQuantity(id, delta) { setCart(previous => { const next = { ...previous }; next[id] = Math.min(99, Math.max(0, (next[id] || 0) + delta)); if (!next[id]) delete next[id]; return next; }); }
  function setCartQuantity(id, quantity) { setCart(previous => { const next = { ...previous }; next[id] = Math.min(99, Math.max(1, quantity)); return next; }); }
  function openOrders() {
    if (authSession?.user.role !== 'customer') {
      if (!authSession) window.location.assign('/login');
      else setMessage('My Orders is available to customer accounts.');
      return;
    }
    setCustomerPage('orders');
    setShowCartPage(false);
    setSelectedProduct(null);
    setActiveOrderId(null);
  }
  function beginCheckout() {
    if (authSession?.user.role !== 'customer') {
      if (!authSession) window.location.assign('/login');
      else setMessage('Checkout is available to customer accounts.');
      return;
    }
    setModal(null);
    setCustomerPage('checkout');
  }
  function openModal(value) {
    if (value === 'manage' && authSession?.user.role !== 'admin') {
      if (!authSession) window.location.assign('/admin/login');
      else setMessage('Administrator access is required.');
      return;
    }
    setFormError('');
    setModal(value);
  }
  function logout() {
    try {
      clearAuthSession();
    } catch (logoutError) {
      setMessage(logoutError.message);
      return;
    }
    setAuthSession(null);
    setModal(null);
    setCustomerPage(null);
    setShowCartPage(false);
    setMessage('You have signed out.');
  }
  async function createOrder({ customer }) {
    if (authSession?.user.role !== 'customer') throw new Error('Sign in with a customer account to place an order.');
    if (!cartProducts.length) throw new Error('Your cart is empty.');
    const order = await api('/orders', {
      method: 'POST',
      requiresAuth: 'customer',
      body: {
        customer: {
          name: customer.name.trim(),
          email: customer.email.trim(),
          address: customer.address.trim(),
        },
        items: cartProducts.map(product => ({ product: product._id, quantity: cart[product._id] })),
      },
    });
    if (typeof order.id !== 'string' || !Number.isFinite(order.total) || typeof order.status !== 'string') {
      throw new Error('The API returned an unexpected order confirmation. Your cart has been kept.');
    }
    setCart({});
    return order;
  }
  function openEditor(product = null) {
    if (authSession?.user.role !== 'admin') {
      setFormError('Administrator access is required.');
      return;
    }
    setEditing(product); setFormError(''); setModal('edit');
  }
  async function saveProduct(event) {
    event.preventDefault();
    if (authSession?.user.role !== 'admin') { setFormError('Administrator access is required.'); return; }
    const data = Object.fromEntries(new FormData(event.currentTarget)); data.price = Number(data.price);
    setBusy(true); setFormError('');
    try { const saved = await api(`/products${editing ? `/${editing._id}` : ''}`, { method: editing ? 'PUT' : 'POST', requiresAuth: 'admin', body: data }); setProducts(previous => editing ? previous.map(p => p._id === saved._id ? saved : p) : [...previous, saved]); setLastSynced(new Date()); setModal('manage'); setMessage('Gadget saved to the live catalog'); }
    catch (e) { setFormError(e.message); } finally { setBusy(false); }
  }
  async function deleteProduct(product) {
    if (authSession?.user.role !== 'admin') { setFormError('Administrator access is required.'); return; }
    if (!confirm(`Delete ${product.name}?`)) return;
    setBusy(true); setFormError('');
    try { await api(`/products/${product._id}`, { method: 'DELETE', requiresAuth: 'admin' }); setProducts(previous => previous.filter(p => p._id !== product._id)); setLastSynced(new Date()); setCart(previous => { const next = { ...previous }; delete next[product._id]; return next; }); setMessage('Gadget deleted from the live catalog'); }
    catch (e) { setFormError(e.message); } finally { setBusy(false); }
  }
  const close = () => { if (!busy) { setModal(null); setFormError(''); } };
  return <>
    <StoreHeader setModal={openModal} onShowOrders={openOrders} onLogout={logout} user={authSession?.user} category={category} showHero={isHome && !customerPage && !showCartPage} count={count} />
    <main>{customerPage === 'checkout' ? <CheckoutPage items={cartProducts.map(product => ({ product, quantity: cart[product._id] }))} subtotal={subtotal} onPlaceOrder={createOrder} onBack={() => setCustomerPage(null)} onViewOrders={openOrders} onContinueShopping={() => { setCustomerPage(null); setShowCartPage(false); }} /> : customerPage === 'orders' ? <MyOrdersPage orders={orders} loading={ordersLoading} error={ordersError} onRefresh={() => setOrdersRefresh(value => value + 1)} onViewDetails={id => { setActiveOrderId(id); setCustomerPage('order-details'); }} /> : customerPage === 'order-details' ? <OrderDetailsPage order={orders.find(order => order._id === activeOrderId)} onBack={() => setCustomerPage('orders')} /> : showCartPage ? <CartPage items={cartProducts.map(product => ({ product, quantity: cart[product._id], maxQuantity: Number.isInteger(product.stock) && product.stock >= 0 ? Math.min(99, product.stock) : 99 }))} count={count} subtotal={subtotal} onQuantityChange={setCartQuantity} onRemove={id => setCart(previous => { const next = { ...previous }; delete next[id]; return next; })} onContinueShopping={() => setShowCartPage(false)} onCheckout={beginCheckout} /> : !isHome && !page ? <section className="shop empty"><h1>Page not found.</h1><a className="dark-button" href="/">Back to the shop ↗</a></section> : <section id="shop" className={`shop ${page ? 'category-shop' : ''}`}>
    {page && <nav className="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">{page.name}</span></nav>}
    <div className="section-heading"><div className="eyebrow">{page ? 'SHOP BY CATEGORY' : 'THE LATEST'}</div><div className="heading-row"><h2>{page ? page.name : 'See what’s new, right now.'}</h2><span>{shown.length} products</span></div><p>{page ? page.description : 'The latest gadgets and everyday technology, selected for how you live, work, and play.'}</p></div>
    <div className="toolbar"><nav className="categories" aria-label="Product categories"><a href="/#shop" className={!page ? 'selected' : ''} aria-current={!page ? 'page' : undefined}>All products</a>{categoryPages.map(c => <a key={c.slug} href={categoryPath(c.name)} className={category === c.name ? 'selected' : ''} aria-current={category === c.name ? 'page' : undefined}>{c.name}</a>)}</nav><div className="filters"><label className="search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search gadgets" aria-label="Search products" /></label><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort products"><option value="featured">Sort: Featured</option><option value="low">Price: Low to high</option><option value="high">Price: High to low</option><option value="name">Name: A to Z</option></select></div></div>
    <div className="catalog-status" aria-live="polite"><span className="live-dot" /> Live catalog {lastSynced && `· Updated ${lastSynced.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}</div>
    {loading ? <p className="empty" role="status">Loading products…</p> : error ? <div className="empty" role="alert"><p>{error}</p><button className="small-button" onClick={() => load()}>Try again</button></div> : <div className="product-grid">{shown.length ? shown.map(p => <article className="product-card" key={p._id}><div className="product-image"><button className="product-image-button" onClick={() => setSelectedProduct(p)} aria-label={`View ${p.name}`}><img loading="lazy" src={p.image} alt={p.name} /></button>{p.badge && <span className="badge">{p.badge}</span>}<button className="add-bag" onClick={() => { changeQuantity(p._id, 1); setMessage('Added to your bag'); }} aria-label={`Add ${p.name} to bag`}><ShoppingBagIcon size={18} /></button></div><div className="product-info"><div><h3><button className="product-title-link" onClick={() => setSelectedProduct(p)}>{p.name}</button></h3><p>{p.description}</p></div><span className="price">{money(p.price)}</span></div></article>) : <p className="empty">{search ? 'No products match your search. Try another search.' : `No ${page ? page.name.toLowerCase() : ''} products yet. Add your first item through Manage gadgets.`}</p>}</div>}
    <div className="collection-end">More ways to power your day.<span><ShoppingBagIcon /></span></div></section>}
    {!showCartPage && !customerPage && <section className="story" id="story"><div className="eyebrow">WHY SEAN &amp; JC.CO</div><h2>Great tech.<br />Simply chosen.</h2><p>We bring together useful technology for work, play, and everything in between. Compare less, enjoy more, and find the setup that feels right for you.</p><span>Explore the store →</span></section>}</main>
    <footer><a href="/" className="brand">Sean <span>&amp;</span> JC.co</a><span>Technology for everyday life.</span><small>© 2026 Sean &amp; JC.co · Demo store</small></footer>
    {selectedProduct && <ProductDetails product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToBag={() => { changeQuantity(selectedProduct._id, 1); setMessage('Added to your bag'); }} />}
    {modal === 'manage' && <Dialog title="Manage gadgets" close={close} wide><p className="manager-note">Products save to MongoDB Atlas when your Atlas URI is configured. Open browsers refresh the catalog every 15 seconds.</p><button className="dark-button" disabled={loading || !!error || busy} onClick={() => openEditor()}>+ Add gadget</button>{formError && <p role="alert">{formError}</p>}{products.map(p => <div className="manage-item" key={p._id}><img src={p.image} alt="" /><div className="item-copy"><strong>{p.name}</strong><p>{p.category} · {money(p.price)}</p></div><button className="small-button" disabled={busy} onClick={() => openEditor(p)}>Edit</button><button className="small-button" disabled={busy} onClick={() => deleteProduct(p)}>Delete</button></div>)}</Dialog>}
    {modal === 'edit' && <Dialog title={editing ? 'Edit gadget' : 'Add gadget'} close={close}><form onSubmit={saveProduct}><label>Gadget name<input name="name" defaultValue={editing?.name} required maxLength={80} /></label><div className="form-row"><label>Price (₱)<input name="price" type="number" min="0.01" max="1000000" step="0.01" defaultValue={editing?.price} required /></label><label>Category<select name="category" defaultValue={editing?.category || page?.name || 'Phones'}>{categories.map(c => <option key={c}>{c}</option>)}</select></label></div><label>Short specifications<input name="description" defaultValue={editing?.description} required maxLength={100} placeholder="e.g. 6.1-inch display · 256GB" /></label><label>Image URL<input name="image" type="url" defaultValue={editing?.image} required /></label><label>Label (optional)<input name="badge" defaultValue={editing?.badge} maxLength={30} placeholder="e.g. New" /></label>{formError && <p role="alert">{formError}</p>}<button disabled={busy} className="dark-button">{busy ? 'Saving…' : 'Save gadget →'}</button><button type="button" disabled={busy} className="text-button" onClick={() => setModal('manage')}>Back to gadgets</button></form></Dialog>}
    {modal === 'cart' && <Dialog title="Your bag" close={close}>{cartProducts.length ? <>{cartProducts.map(p => <div className="cart-item" key={p._id}><img src={p.image} alt={p.name} /><div className="item-copy"><strong>{p.name}</strong><p>{money(p.price)}</p><button className="remove" onClick={() => changeQuantity(p._id, -99)}>Remove</button></div><div className="quantity"><button onClick={() => changeQuantity(p._id, -1)} aria-label={`Decrease ${p.name} quantity`}>−</button><span>{cart[p._id]}</span><button disabled={cart[p._id] >= 99} onClick={() => changeQuantity(p._id, 1)} aria-label={`Increase ${p.name} quantity`}>+</button></div></div>)}<div className="total"><span>Subtotal</span><span>{money(subtotal)}</span></div><p className="manager-note">{shipping ? 'Demo shipping: ₱8. Free on orders over ₱100.' : 'Your order qualifies for free shipping.'}</p><button className="dark-button full-button" onClick={() => { setModal(null); setShowCartPage(true); }}>View full cart</button><button className="text-button" onClick={beginCheckout}>Proceed to checkout ↗</button></> : <><p className="empty">Your bag is waiting for something good.</p><button className="dark-button full-button" onClick={() => { setModal(null); setShowCartPage(true); }}>View full cart</button></>}</Dialog>}
    <div id="toast" className={message ? 'visible' : ''} role="status">{message}</div>
  </>;
}
createRoot(document.getElementById('root')).render(authPage ? <AuthPages type={authPage} /> : <App />);
