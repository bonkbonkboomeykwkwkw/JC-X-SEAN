import { useEffect, useState } from 'react';
import './product-details.css';

const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

export default function ProductDetails({ product, onClose, onAddToBag }) {
  const [imageError, setImageError] = useState(false);
  const stock = Number.isInteger(product.stock) && product.stock >= 0 ? product.stock : null;
  const unavailable = stock === 0;

  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => { setImageError(false); }, [product]);

  return <div className="product-popover-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="product-popover" role="dialog" aria-modal="true" aria-labelledby="product-detail-title">
      <button className="product-popover-close" onClick={onClose} aria-label="Close product details">×</button>
      <div className="product-popover-image">
        {product.image && !imageError ? <img src={product.image} alt={product.name} onError={() => setImageError(true)} /> : <div className="product-popover-image-fallback">Image unavailable</div>}
        {product.badge && <span className="badge">{product.badge}</span>}
      </div>
      <div className="product-popover-copy">
        <div className="eyebrow">{product.category || 'COLLECTION'}</div>
        <h2 id="product-detail-title">{product.name}</h2>
        <p className="product-popover-price">{money(product.price)}</p>
        <p className="product-popover-description">{product.description || 'No description available.'}</p>
        <p className={`product-popover-availability ${unavailable ? 'out-of-stock' : ''}`}>{unavailable ? 'Currently unavailable' : stock === null ? 'Available now' : `${stock} available`}</p>
        <button className="dark-button product-popover-action" disabled={unavailable} onClick={() => { onAddToBag(); onClose(); }}>
          {unavailable ? 'Unavailable' : 'Add to bag'} <span>↗</span>
        </button>
      </div>
    </section>
  </div>;
}
