import { useState } from 'react';
import ShoppingBagIcon from './ShoppingBagIcon';
import './cart-page.css';

const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

function CartImage({ product }) {
  const [failed, setFailed] = useState(false);
  return product.image && !failed
    ? <img src={product.image} alt={product.name} onError={() => setFailed(true)} />
    : <div className="cart-page-image-fallback" aria-label={`${product.name} image unavailable`}>Image unavailable</div>;
}

export default function CartPage({ items, count, subtotal, onQuantityChange, onRemove, onContinueShopping, onCheckout }) {
  const [feedback, setFeedback] = useState('');
  const shipping = subtotal >= 100 ? 0 : 8;

  return <section className="cart-page" aria-labelledby="cart-page-title">
    <div className="cart-page-heading">
      <div>
        <div className="eyebrow">YOUR EVERYDAY FINDS</div>
        <h1 id="cart-page-title">Shopping cart</h1>
      </div>
      <span className="cart-page-count">{count} {count === 1 ? 'item' : 'items'}</span>
    </div>

    {!items.length ? <div className="cart-page-empty">
      <ShoppingBagIcon size={42} />
      <h2>Your bag is taking a breather.</h2>
      <p>Find something useful, lovely, or just right for your everyday.</p>
      <button className="dark-button" onClick={onContinueShopping}>Continue shopping <span>↗</span></button>
    </div> : <div className="cart-page-layout">
      <div className="cart-page-items">
        <div className="cart-page-items-heading"><span>Product</span><span>Quantity</span><span>Subtotal</span></div>
        {items.map(({ product, quantity, maxQuantity }) => <article className="cart-page-item" key={product._id}>
          <div className="cart-page-product">
            <div className="cart-page-image"><CartImage product={product} /></div>
            <div className="cart-page-product-info">
              <span>{product.category}</span>
              <h2>{product.name}</h2>
              <p>{money(product.price)} each</p>
              <button className="cart-page-remove" onClick={() => onRemove(product._id)}>Remove</button>
            </div>
          </div>
          <div className="cart-page-quantity" aria-label={`Quantity for ${product.name}`}>
            <button type="button" aria-label={`Decrease ${product.name} quantity`} disabled={quantity <= 1} onClick={() => onQuantityChange(product._id, quantity - 1)}>−</button>
            <output aria-live="polite">{quantity}</output>
            <button type="button" aria-label={`Increase ${product.name} quantity`} disabled={quantity >= maxQuantity} onClick={() => onQuantityChange(product._id, quantity + 1)}>+</button>
          </div>
          <strong className="cart-page-line-total">{money(Math.round(product.price * 100) * quantity / 100)}</strong>
        </article>)}
        <button className="cart-page-continue" onClick={onContinueShopping}>← Continue shopping</button>
      </div>
      <aside className="cart-page-summary" aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">Order summary</h2>
        <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
        <div><span>Shipping <small>(estimate)</small></span><strong>{shipping ? money(shipping) : 'Free'}</strong></div>
        <p className="cart-page-shipping-note">{shipping ? 'Standard shipping estimate. Free on orders over $100.' : 'Your order qualifies for free shipping.'}</p>
        <div className="cart-page-estimated-total"><span>Estimated total</span><strong>{money(subtotal + shipping)}</strong></div>
        <button className="dark-button cart-page-checkout" onClick={onCheckout}>Proceed to checkout <span>↗</span></button>
      </aside>
    </div>}
  </section>;
}
