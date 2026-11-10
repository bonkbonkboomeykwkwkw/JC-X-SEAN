import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Product from './models/Product.js';
import Order from './models/Order.js';
export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.get('/api/health', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api', (_req, res, next) => mongoose.connection.readyState === 1 ? next() : res.status(503).json({ message: 'Database unavailable. Configure MONGODB_URI and start MongoDB.' }));
const fields = ['name', 'description', 'price', 'category', 'image', 'badge'];
function productInput(body) {
  const result = {};
  for (const key of fields) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== (key === 'price' ? 'number' : 'string') || (key === 'price' && !Number.isFinite(body[key]))) throw Object.assign(new Error(`Invalid ${key}`), { status: 400 });
    result[key] = body[key];
  }
  return result;
}
app.param('id', (req, res, next, id) => mongoose.isObjectIdOrHexString(id) ? next() : res.status(400).json({ message: 'Invalid product ID' }));
app.get('/api/products', async (_req, res) => res.json(await Product.find().sort({ createdAt: 1 })));
app.get('/api/products/:id', async (req, res) => { const product = await Product.findById(req.params.id); res.status(product ? 200 : 404).json(product || { message: 'Product not found' }); });
app.post('/api/products', async (req, res) => res.status(201).json(await Product.create(productInput(req.body))));
app.put('/api/products/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  Object.assign(product, productInput(req.body));
  res.json(await product.save());
});
app.delete('/api/products/:id', async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  res.status(product ? 200 : 404).json({ message: product ? 'Product deleted' : 'Product not found' });
});
app.post('/api/orders', async (req, res) => {
  const { customer, items } = req.body;
  if (!customer || !['name', 'email', 'address'].every(key => typeof customer[key] === 'string' && customer[key].trim() && customer[key].length <= 500) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return res.status(400).json({ message: 'Valid customer name, email and shipping address are required' });
  if (!Array.isArray(items) || !items.length || items.length > 100 || items.some(item => !item || !mongoose.isObjectIdOrHexString(item.product) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) || new Set(items.map(item => item.product)).size !== items.length) return res.status(400).json({ message: 'Provide unique products with quantities between 1 and 99' });
  const products = await Product.find({ _id: { $in: items.map(item => item.product) } });
  if (products.length !== items.length) return res.status(409).json({ message: 'A product is no longer available. Refresh your bag.' });
  const orderItems = items.map(item => { const p = products.find(p => String(p._id) === item.product); return { product: p._id, name: p.name, price: p.price, quantity: item.quantity }; });
  const cents = orderItems.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0);
  const shipping = cents >= 10000 ? 0 : 8;
  const order = await Order.create({ customer: { name: customer.name.trim(), email: customer.email.trim(), address: customer.address.trim() }, items: orderItems, subtotal: cents / 100, shipping, total: cents / 100 + shipping });
  res.status(201).json({ id: order._id, total: order.total, status: order.status });
});
app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found' }));
const dist = fileURLToPath(new URL('../client/dist/', import.meta.url));
app.use(express.static(dist));
app.get('/', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
app.use((error, _req, res, _next) => {
  const status = error.status || (['ValidationError', 'CastError'].includes(error.name) ? 400 : 500);
  res.status(status).json({ message: status < 500 ? error.message : 'An unexpected server error occurred' });
});
