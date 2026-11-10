import ShoppingBagIcon from './ShoppingBagIcon';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import StoreHeader from './StoreHeader';
import './style.css';
import { categories, categoryPages, categoryPath, categoryFromPath } from '../../shared/categories.js';
const page = categoryFromPath(window.location.pathname);
const isHome = window.location.pathname === '/';
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
async function api(url, options = {}) {
  let response;
  try { response = await fetch(`/api${url}`, { ...options, headers: { 'Content-Type': 'application/json' }, body: options.body ? JSON.stringify(options.body) : undefined }); }
  catch { throw new Error('Cannot reach the API. Check that the server and MongoDB are running.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed. Check the API and database connection.');
  return data;
}
function Dialog({ title, children, close, wide }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className={wide ? 'wide-dialog' : ''} onCancel={close}><div className="dialog-heading"><h2>{title}</h2><button className="close" onClick={close} aria-label="Close dialog">×</button></div>{children}</dialog>;
}
function App() {
  const [products, setProducts] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const category = page?.name || 'All products';
  const [search, setSearch] = useState(''), [sort, setSort] = useState('featured');
  const [modal, setModal] = useState(null), [editing, setEditing] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [cart, setCart] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('ff-mern-cart')); return saved && typeof saved === 'object' && !Array.isArray(saved) ? Object.fromEntries(Object.entries(saved).filter(([, q]) => Number.isInteger(q) && q > 0 && q <= 99)) : {}; } catch { return {}; } });
  const [formError, setFormError] = useState('');
  async function load() { setLoading(true); setError(''); try { setProducts(await api('/products')); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { load(); document.title = `${page ? page.name : isHome ? 'Products for everyday life' : 'Page not found'} — Sean and JC.co`; }, []);
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
  function openEditor(product = null) { setEditing(product); setFormError(''); setModal('edit'); }
  async function saveProduct(event) {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); data.price = Number(data.price);
    setBusy(true); setFormError('');
    try { const saved = await api(`/products${editing ? `/${editing._id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: data }); setProducts(previous => editing ? previous.map(p => p._id === saved._id ? saved : p) : [...previous, saved]); setModal('manage'); setMessage('Product saved'); }
    catch (e) { setFormError(e.message); } finally { setBusy(false); }
  }
  async function deleteProduct(product) {
    if (!confirm(`Delete ${product.name}?`)) return;
    setBusy(true); setFormError('');
    try { await api(`/products/${product._id}`, { method: 'DELETE' }); setProducts(previous => previous.filter(p => p._id !== product._id)); setCart(previous => { const next = { ...previous }; delete next[product._id]; return next; }); setMessage('Product deleted'); }
    catch (e) { setFormError(e.message); } finally { setBusy(false); }
  }
  async function checkout(event) {
    event.preventDefault(); const customer = Object.fromEntries(new FormData(event.currentTarget)); setBusy(true); setFormError('');
    try { const order = await api('/orders', { method: 'POST', body: { customer, items: cartProducts.map(p => ({ product: p._id, quantity: cart[p._id] })) } }); setCart({}); setModal(null); setMessage(`Demo order ${order.id.slice(-6)} saved. Total: ${money(order.total)}. Thank you!`); }
    catch (e) { setFormError(e.message); } finally { setBusy(false); }
  }
  const close = () => { if (!busy) { setModal(null); setFormError(''); } };
  return <>
    <StoreHeader setModal={value => { setFormError(''); setModal(value); }} category={category} showHero={isHome} count={count} />
    <main>{!isHome && !page ? <section className="shop empty"><h1>Page not found.</h1><a className="dark-button" href="/">Back to the shop ↗</a></section> : <section id="shop" className={`shop ${page ? 'category-shop' : ''}`}>
    {page && <nav className="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">{page.name}</span></nav>}
    <div className="section-heading"><div className="eyebrow">{page ? 'SHOP BY CATEGORY' : 'SHOP ALL PRODUCTS'}</div><div className="heading-row"><h2>{page ? page.name : 'Find your everyday favorite.'}</h2><span>{shown.length} products</span></div><p>{page ? page.description : "Explore products for your interests, activities, and everyday needs."}</p></div>
    <div className="toolbar"><nav className="categories" aria-label="Product categories"><a href="/#shop" className={!page ? 'selected' : ''} aria-current={!page ? 'page' : undefined}>All products</a>{categoryPages.map(c => <a key={c.slug} href={categoryPath(c.name)} className={category === c.name ? 'selected' : ''} aria-current={category === c.name ? 'page' : undefined}>{c.name}</a>)}</nav><div className="filters"><label className="search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find something good" aria-label="Search products" /></label><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort products"><option value="featured">Sort: Featured</option><option value="low">Price: Low to high</option><option value="high">Price: High to low</option><option value="name">Name: A to Z</option></select></div></div>
    {loading ? <p className="empty" role="status">Loading products…</p> : error ? <div className="empty" role="alert"><p>{error}</p><button className="small-button" onClick={load}>Try again</button></div> : <div className="product-grid">{shown.length ? shown.map(p => <article className="product-card" key={p._id}><div className="product-image"><img loading="lazy" src={p.image} alt={p.name} />{p.badge && <span className="badge">{p.badge}</span>}<button className="add-bag" onClick={() => { changeQuantity(p._id, 1); setMessage('Added to your bag'); }} aria-label={`Add ${p.name} to bag`}>+</button></div><div className="product-info"><div><h3>{p.name}</h3><p>{p.description}</p></div><span className="price">{money(p.price)}</span></div></article>) : <p className="empty">{search ? 'No products match your search. Try another search.' : `No ${page ? page.name.toLowerCase() : ''} products yet. Add your first item through Manage store.`}</p>}</div>}
    <div className="collection-end">More categories. More possibilities. Find what works for you.<span><ShoppingBagIcon /></span></div></section>}
    <section className="story" id="story"><div className="eyebrow">FOR THE WAY YOU LIVE</div><h2>Whatever your day holds.<br />Find it here.</h2><p>Whether you’re picking up a new hobby, getting active, or checking off your daily essentials, explore a range of products in one place. Sean and JC.co brings together choices for different interests, routines, and lifestyles.</p><span>That's the Sean and JC.co way. ↗</span></section></main>
    <footer><a href="/" className="brand">Sean and JC.co</a><span>Something for every day.</span><small>© 2026 Sean and JC.co · Demo store</small></footer>
    {modal === 'manage' && <Dialog title="Manage products" close={close} wide><p className="manager-note">Products are saved to MongoDB and shared across browsers.</p><button className="dark-button" disabled={loading || !!error || busy} onClick={() => openEditor()}>+ Add product</button>{formError && <p role="alert">{formError}</p>}{products.map(p => <div className="manage-item" key={p._id}><img src={p.image} alt="" /><div className="item-copy"><strong>{p.name}</strong><p>{p.category} · {money(p.price)}</p></div><button className="small-button" disabled={busy} onClick={() => openEditor(p)}>Edit</button><button className="small-button" disabled={busy} onClick={() => deleteProduct(p)}>Delete</button></div>)}</Dialog>}
    {modal === 'edit' && <Dialog title={editing ? 'Edit product' : 'Add product'} close={close}><form onSubmit={saveProduct}><label>Product name<input name="name" defaultValue={editing?.name} required maxLength={80} /></label><div className="form-row"><label>Price ($)<input name="price" type="number" min="0.01" max="1000000" step="0.01" defaultValue={editing?.price} required /></label><label>Category<select name="category" defaultValue={editing?.category || page?.name || 'Living'}>{categories.map(c => <option key={c}>{c}</option>)}</select></label></div><label>Product description<input name="description" defaultValue={editing?.description} required maxLength={100} /></label><label>Image URL<input name="image" type="url" defaultValue={editing?.image} required /></label><label>Label (optional)<input name="badge" defaultValue={editing?.badge} maxLength={30} /></label>{formError && <p role="alert">{formError}</p>}<button disabled={busy} className="dark-button">{busy ? 'Saving…' : 'Save product ↗'}</button><button type="button" disabled={busy} className="text-button" onClick={() => setModal('manage')}>Back to products</button></form></Dialog>}
    {modal === 'cart' && <Dialog title="Your bag" close={close}>{cartProducts.length ? <>{cartProducts.map(p => <div className="cart-item" key={p._id}><img src={p.image} alt={p.name} /><div className="item-copy"><strong>{p.name}</strong><p>{money(p.price)}</p><button className="remove" onClick={() => changeQuantity(p._id, -99)}>Remove</button></div><div className="quantity"><button onClick={() => changeQuantity(p._id, -1)} aria-label={`Decrease ${p.name} quantity`}>−</button><span>{cart[p._id]}</span><button disabled={cart[p._id] >= 99} onClick={() => changeQuantity(p._id, 1)} aria-label={`Increase ${p.name} quantity`}>+</button></div></div>)}<div className="total"><span>Subtotal</span><span>{money(subtotal)}</span></div><p className="manager-note">{shipping ? 'Demo shipping: $8. Free on orders over $100.' : 'Your order qualifies for free shipping.'}</p><button className="dark-button full-button" onClick={() => setModal('checkout')}>Continue to checkout ↗</button></> : <p className="empty">Your bag is waiting for something good.</p>}</Dialog>}
    {modal === 'checkout' && <Dialog title="A good choice." close={close}><p>This is a demo order. No payment is collected.</p><form onSubmit={checkout}><label>Your name<input name="name" required maxLength={500} autoComplete="name" /></label><label>Email address<input name="email" type="email" required maxLength={500} autoComplete="email" /></label><label>Shipping address<textarea name="address" required maxLength={500} autoComplete="street-address" /></label><p>Estimated total: {money(subtotal + shipping)} including shipping. Final prices are checked by the server.</p>{formError && <p role="alert">{formError}</p>}<button className="dark-button" disabled={busy || !cartProducts.length}>{busy ? 'Placing order…' : 'Place demo order ↗'}</button></form></Dialog>}
    <div id="toast" className={message ? 'visible' : ''} role="status">{message}</div>
  </>;
}
createRoot(document.getElementById('root')).render(<App />);
