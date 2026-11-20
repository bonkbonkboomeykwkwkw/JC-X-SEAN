import { useEffect, useState } from 'react';
import './product-details.css';

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export default function ProductDetails({ product, onBack }) {
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [imageError, setImageError] = useState(false);
  const stock = Number.isInteger(product.stock) && product.stock >= 0 ? product.stock : null;
  const unavailable = stock === 0;

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(''), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    setQuantity(1);
    setFeedback('');
    setImageError(false);
  }, [product]);

  return <section className="product-detail" aria-labelledby="product-detail-title">
    <button className="product-detail-back" onClick={onBack}>← Back to products</button>
    <div className="product-detail-layout">
      <div className="product-detail-visual">
        <div className="product-detail-image">
          {product.image && !imageError ? <img src={product.image} alt={product.name} onError={() => setImageError(true)} /> : <div className="product-detail-image-fallback">Image unavailable</div>}
          {product.badge && <span className="badge">{product.badge}</span>}
        </div>
      </div>
      <div className="product-detail-copy">
        <div className="eyebrow">{product.category || 'COLLECTION'}</div>
        <h1 id="product-detail-title">{product.name}</h1>
        <p className="product-detail-price">{money(product.price)}</p>
        <p className="product-detail-description">{product.description}</p>
        <div className={`product-detail-availability ${stock === null ? 'unknown-stock' : unavailable ? 'out-of-stock' : ''}`}>
          <span aria-hidden="true"></span>
          {stock === null ? 'Availability not provided' : unavailable ? 'Currently unavailable' : `${stock} available`}
        </div>
        <div className="product-detail-purchase">
          <label className="product-detail-quantity-label">Quantity</label>
          <div className="product-detail-quantity" aria-label="Quantity selector">
            <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))}>−</button>
            <output aria-live="polite">{quantity}</output>
            <button type="button" aria-label="Increase quantity" disabled={unavailable || (stock !== null && quantity >= stock)} onClick={() => setQuantity(value => stock === null ? value + 1 : Math.min(stock, value + 1))}>+</button>
          </div>
          <button className="dark-button product-detail-action" disabled={unavailable} onClick={() => setFeedback(`${product.name} added to your bag (preview only).`)}>Add to bag <span>↗</span></button>
          <button className="product-detail-buy" disabled={unavailable} onClick={() => setFeedback(`Buy now is a preview for ${product.name}; checkout is not connected here.`)}>Buy now</button>
        </div>
        <div className="product-detail-note" role="status" aria-live="polite">{feedback}</div>
        <div className="product-detail-extra">
          <div><span>Category</span><strong>{product.category || 'Not specified'}</strong></div>
          <div><span>Product details</span><p>{product.description || 'No additional details provided.'}</p></div>
        </div>
      </div>
    </div>
  </section>;
}