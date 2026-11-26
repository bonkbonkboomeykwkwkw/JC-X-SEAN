import ShoppingBagIcon from './ShoppingBagIcon';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import StoreHeader from './StoreHeader';
import AuthPages from './AuthPages';
import AdminPage from './AdminPage';
import ProductDetails from './ProductDetails';
import CartPage from './CartPage';
import { CheckoutPage, MyOrdersPage, OrderDetailsPage } from './CustomerOrderPages';
import { api, authExpiredEvent, clearAuthSession, readAuthState } from './api';
import './style.css';
import { categoryPages, categoryPath, categoryFromPath } from '../../shared/categories.js';
const pathname = window.location.pathname.replace(/\/$/, '') || '/';
const page = categoryFromPath(pathname);
const isHome = pathname === '/';
const authPage = ({ '/register': 'register', '/login': 'login', '/admin/login': 'admin' })[pathname];
const adminTab = ({ '/admin': 'overview', '/admin/orders': 'orders', '/admin/products': 'products' })[pathname];
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
  const [modal, setModal] = useState(null), [message, setMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCartPage, setShowCartPage] = useState(false);
  const [customerPage, setCustomerPage] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [ordersRefresh, setOrdersRefresh] = useState(0);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [cart, setCart] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('ff-mern-cart')); return saved && typeof saved === 'object' && !Array.isArray(saved) ? Object.fromEntries(Object.entries(saved).filter(([, q]) => Number.isInteger(q) && q > 0 && q <= 99)) : {}; } catch { return {}; } });
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
  const close = () => setModal(null);
  return <>
    <StoreHeader setModal={openModal} onShowOrders={openOrders} onLogout={logout} user={authSession?.user} category={category} showHero={isHome && !customerPage && !showCartPage} count={count} />
    <main>{customerPage === 'checkout' ? <CheckoutPage items={cartProducts.map(product => ({ product, quantity: cart[product._id] }))} subtotal={subtotal} onPlaceOrder={createOrder} onBack={() => setCustomerPage(null)} onViewOrders={openOrders} onContinueShopping={() => { setCustomerPage(null); setShowCartPage(false); }} /> : customerPage === 'orders' ? <MyOrdersPage orders={orders} loading={ordersLoading} error={ordersError} onRefresh={() => setOrdersRefresh(value => value + 1)} onViewDetails={id => { setActiveOrderId(id); setCustomerPage('order-details'); }} /> : customerPage === 'order-details' ? <OrderDetailsPage order={orders.find(order => order._id === activeOrderId)} onBack={() => setCustomerPage('orders')} /> : showCartPage ? <CartPage items={cartProducts.map(product => ({ product, quantity: cart[product._id], maxQuantity: Number.isInteger(product.stock) && product.stock >= 0 ? Math.min(99, product.stock) : 99 }))} count={count} subtotal={subtotal} onQuantityChange={setCartQuantity} onRemove={id => setCart(previous => { const next = { ...previous }; delete next[id]; return next; })} onContinueShopping={() => setShowCartPage(false)} onCheckout={beginCheckout} /> : !isHome && !page ? <section className="shop empty"><h1>Page not found.</h1><a className="dark-button" href="/">Back to the shop ↗</a></section> : <section id="shop" className={`shop ${page ? 'category-shop' : ''}`}>
    {page && <nav className="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">{page.name}</span></nav>}
    <div className="section-heading"><div className="eyebrow">{page ? 'SHOP BY CATEGORY' : 'THE LATEST'}</div><div className="heading-row"><h2>{page ? page.name : 'See what’s new, right now.'}</h2><span>{shown.length} products</span></div><p>{page ? page.description : 'The latest gadgets and everyday technology, selected for how you live, work, and play.'}</p></div>
    <div className="toolbar"><nav className="categories" aria-label="Product categories"><a href="/#shop" className={!page ? 'selected' : ''} aria-current={!page ? 'page' : undefined}>All products</a>{categoryPages.map(c => <a key={c.slug} href={categoryPath(c.name)} className={category === c.name ? 'selected' : ''} aria-current={category === c.name ? 'page' : undefined}>{c.name}</a>)}</nav><div className="filters"><label className="search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search gadgets" aria-label="Search products" /></label><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort products"><option value="featured">Sort: Featured</option><option value="low">Price: Low to high</option><option value="high">Price: High to low</option><option value="name">Name: A to Z</option></select></div></div>
    <div className="catalog-status" aria-live="polite"><span className="live-dot" /> Live catalog {lastSynced && `· Updated ${lastSynced.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}</div>
    {loading ? <p className="empty" role="status">Loading products…</p> : error ? <div className="empty" role="alert"><p>{error}</p><button className="small-button" onClick={() => load()}>Try again</button></div> : <div className="product-grid">{shown.length ? shown.map(p => <article className="product-card" key={p._id}><div className="product-image"><button className="product-image-button" onClick={() => setSelectedProduct(p)} aria-label={`View ${p.name}`}><img loading="lazy" src={p.image} alt={p.name} /></button>{p.badge && <span className="badge">{p.badge}</span>}<button className="add-bag" onClick={() => { changeQuantity(p._id, 1); setMessage('Added to your bag'); }} aria-label={`Add ${p.name} to bag`}><ShoppingBagIcon size={18} /></button></div><div className="product-info"><div><h3><button className="product-title-link" onClick={() => setSelectedProduct(p)}>{p.name}</button></h3><p>{p.description}</p></div><span className="price">{money(p.price)}</span></div></article>) : <p className="empty">{search ? 'No products match your search. Try another search.' : `No ${page ? page.name.toLowerCase() : ''} products yet.${authSession?.user.role === 'admin' ? ' Add products from the Admin page.' : ''}`}</p>}</div>}
    <div className="collection-end">More ways to power your day.<span><ShoppingBagIcon /></span></div></section>}
    {!showCartPage && !customerPage && <section className="story" id="story"><div className="eyebrow">WHY SEAN &amp; JC.CO</div><h2>Great tech.<br />Simply chosen.</h2><p>We bring together useful technology for work, play, and everything in between. Compare less, enjoy more, and find the setup that feels right for you.</p><span>Explore the store →</span></section>}</main>
    <footer><a href="/" className="brand">Sean <span>&amp;</span> JC.co</a><span>Technology for everyday life.</span><small>© 2026 Sean &amp; JC.co · Demo store</small></footer>
    {selectedProduct && <ProductDetails product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToBag={() => { changeQuantity(selectedProduct._id, 1); setMessage('Added to your bag'); }} />}
    {modal === 'cart' && <Dialog title="Your bag" close={close}>{cartProducts.length ? <>{cartProducts.map(p => <div className="cart-item" key={p._id}><img src={p.image} alt={p.name} /><div className="item-copy"><strong>{p.name}</strong><p>{money(p.price)}</p><button className="remove" onClick={() => changeQuantity(p._id, -99)}>Remove</button></div><div className="quantity"><button onClick={() => changeQuantity(p._id, -1)} aria-label={`Decrease ${p.name} quantity`}>−</button><span>{cart[p._id]}</span><button disabled={cart[p._id] >= 99} onClick={() => changeQuantity(p._id, 1)} aria-label={`Increase ${p.name} quantity`}>+</button></div></div>)}<div className="total"><span>Subtotal</span><span>{money(subtotal)}</span></div><p className="manager-note">{shipping ? 'Demo shipping: ₱8. Free on orders over ₱100.' : 'Your order qualifies for free shipping.'}</p><button className="dark-button full-button" onClick={() => { setModal(null); setShowCartPage(true); }}>View full cart</button><button className="text-button" onClick={beginCheckout}>Proceed to checkout ↗</button></> : <><p className="empty">Your bag is waiting for something good.</p><button className="dark-button full-button" onClick={() => { setModal(null); setShowCartPage(true); }}>View full cart</button></>}</Dialog>}
    <div id="toast" className={message ? 'visible' : ''} role="status">{message}</div>
  </>;
}
function AdminRoute({ initialTab }) {
  const [authState] = useState(() => readAuthState());
  useEffect(() => {
    if (authState.expiredRole || !authState.session) {
      window.location.replace('/admin/login');
    }
  }, [authState]);
  if (authState.expiredRole || !authState.session) {
    return <main className="admin-gate-page"><section className="admin-gate-card"><p>Redirecting to administrator sign in…</p></section></main>;
  }
  if (authState.session.user.role !== 'admin') {
    return <main className="admin-gate-page">
      <section className="admin-gate-card">
        <div className="eyebrow">RESTRICTED AREA</div>
        <h1>Administrator access required</h1>
        <p>You are signed in as {authState.session.user.email}. Switch to an administrator account to access the admin dashboard.</p>
        <div className="admin-gate-actions">
          <a href="/" className="admin-btn-secondary">Back to store</a>
          <button type="button" className="admin-btn-primary" onClick={() => { try { clearAuthSession(); } catch { /* Continue to admin login. */ } window.location.assign('/admin/login'); }}>Sign out &amp; switch account</button>
        </div>
      </section>
    </main>;
  }
  return <AdminPage initialTab={initialTab} session={authState.session} />;
}
createRoot(document.getElementById('root')).render(authPage ? <AuthPages type={authPage} /> : adminTab ? <AdminRoute initialTab={adminTab} /> : <App />);
