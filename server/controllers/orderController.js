import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

export async function createOrder(req, res) {
  const { customer, items } = req.body || {};
  if (!customer || typeof customer !== 'object' || Array.isArray(customer) || !['name', 'email', 'address'].every(key => typeof customer[key] === 'string' && customer[key].trim() && customer[key].length <= 500) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) return res.status(400).json({ message: 'Valid customer name, email and shipping address are required' });
  if (!Array.isArray(items) || !items.length || items.length > 100 || items.some(item => !item || !mongoose.isObjectIdOrHexString(item.product) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) || new Set(items.map(item => item.product)).size !== items.length) return res.status(400).json({ message: 'Provide unique products with quantities between 1 and 99' });
  const products = await Product.find({ _id: { $in: items.map(item => item.product) } });
  if (products.length !== items.length) return res.status(404).json({ message: 'A product is no longer available. Refresh your bag.' });
  const orderItems = items.map(item => { const p = products.find(p => String(p._id) === item.product); return { product: p._id, name: p.name, price: p.price, quantity: item.quantity }; });
  const cents = orderItems.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0);
  const shipping = cents >= 10000 ? 0 : 8;
  const order = await Order.create({ user: req.user._id, customer: { name: customer.name.trim(), email: customer.email.trim(), address: customer.address.trim() }, items: orderItems, subtotal: cents / 100, shipping, total: cents / 100 + shipping });
  res.status(201).json({ id: order._id, total: order.total, status: order.status });
}

export async function getOrders(req, res) {
  const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
  res.json(await Order.find(filter).sort({ createdAt: -1 }));
}
