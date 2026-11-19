import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { categories } from '../../shared/categories.js';

const fields = ['name', 'description', 'price', 'category', 'image', 'badge'];

function productInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('A product object is required'), { status: 400 });
  const result = {};
  for (const key of fields) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== (key === 'price' ? 'number' : 'string') || (key === 'price' && !Number.isFinite(body[key]))) throw Object.assign(new Error(`Invalid ${key}`), { status: 400 });
    result[key] = body[key];
  }
  return result;
}

export async function getProducts(req, res) {
  const filter = {};
  if (req.query.category !== undefined) {
    if (typeof req.query.category !== 'string' || !categories.includes(req.query.category)) return res.status(400).json({ message: 'Invalid product category' });
    filter.category = req.query.category;
  }
  res.json(await Product.find(filter).sort({ createdAt: 1 }));
}

export async function getProduct(req, res) {
  const product = await Product.findById(req.params.id);
  res.status(product ? 200 : 404).json(product || { message: 'Product not found' });
}

export async function createProduct(req, res) {
  res.status(201).json(await Product.create(productInput(req.body)));
}

export async function updateProduct(req, res) {
  const product = await Product.findByIdAndUpdate(req.params.id, productInput(req.body), { runValidators: true, new: true });
  res.status(product ? 200 : 404).json(product || { message: 'Product not found' });
}

export async function deleteProduct(req, res) {
  const product = await Product.findByIdAndDelete(req.params.id);
  res.status(product ? 200 : 404).json({ message: product ? 'Product deleted' : 'Product not found' });
}
