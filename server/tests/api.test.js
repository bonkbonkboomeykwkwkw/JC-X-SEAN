import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../app.js';
import { JWT_AUDIENCE, JWT_ISSUER } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

const jwtSecret = 'test-secret-with-more-than-thirty-two-bytes';
process.env.JWT_SECRET = jwtSecret;

let database, server, base, customerToken, customerId, otherCustomerToken, adminToken;

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});

async function request(path, method = 'GET', body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}

const product = { name: 'Test gadget', description: '128GB storage', price: 30, category: 'Phones', image: 'https://example.com/gadget.jpg' };
const orderCustomer = { name: 'Test Customer', email: 'test@example.com', address: 'Test address' };

test('customer and admin authentication validates credentials and roles', async () => {
  assert.equal((await request('/auth/register', 'POST', { name: '', email: 'bad', password: 'short' })).status, 400);

  const registration = await request('/auth/register', 'POST', {
    name: 'Customer One',
    email: 'customer@example.com',
    password: 'customer-password-123',
    role: 'admin',
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.user.role, 'customer');
  assert.deepEqual(Object.keys(registration.body.user).sort(), ['email', 'id', 'name', 'role']);
  customerToken = registration.body.token;
  customerId = registration.body.user.id;

  const storedCustomer = await User.findById(customerId).select('+passwordHash');
  assert.notEqual(storedCustomer.passwordHash, 'customer-password-123');
  assert.match(storedCustomer.passwordHash, /^\$2[aby]\$/);

  assert.equal((await request('/auth/register', 'POST', {
    name: 'Duplicate',
    email: 'CUSTOMER@example.com',
    password: 'another-password-123',
  })).status, 409);

  const customerLogin = await request('/auth/login', 'POST', { email: 'CUSTOMER@example.com', password: 'customer-password-123' });
  assert.equal(customerLogin.status, 200);
  assert.equal(customerLogin.body.user.role, 'customer');
  assert.equal((await request('/auth/login', 'POST', { email: 'customer@example.com', password: 'wrong-password' })).status, 401);

  const otherRegistration = await request('/auth/register', 'POST', {
    name: 'Customer Two',
    email: 'other@example.com',
    password: 'other-customer-password',
  });
  assert.equal(otherRegistration.status, 201);
  otherCustomerToken = otherRegistration.body.token;

  await User.create({
    name: 'Store Admin',
    email: 'admin@example.com',
    username: 'store-admin',
    passwordHash: await bcrypt.hash('admin-password-123', 12),
    role: 'admin',
  });

  const adminLogin = await request('/auth/admin/login', 'POST', { identity: 'store-admin', password: 'admin-password-123' });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.user.role, 'admin');
  assert.equal(Object.hasOwn(adminLogin.body.user, 'passwordHash'), false);
  adminToken = adminLogin.body.token;
  assert.equal((await request('/auth/admin/login', 'POST', { identity: 'admin@example.com', password: 'admin-password-123' })).status, 200);
  assert.equal((await request('/auth/admin/login', 'POST', { identity: 'admin@example.com', password: 'wrong-password' })).status, 401);
  assert.equal((await request('/auth/admin/login', 'POST', { identity: 'customer@example.com', password: 'customer-password-123' })).status, 401);

  assert.equal((await request('/orders')).status, 401);
  assert.equal((await request('/orders', 'GET', undefined, 'not-a-token')).status, 401);
  const expiredToken = jwt.sign({}, jwtSecret, {
    subject: customerId,
    expiresIn: '-1s',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  const expiredResponse = await request('/orders', 'GET', undefined, expiredToken);
  assert.equal(expiredResponse.status, 401);
  assert.match(expiredResponse.body.message, /expired/i);

  assert.equal((await request('/products', 'POST', product, customerToken)).status, 403);
  assert.equal((await request('/orders', 'POST', { customer: orderCustomer, items: [] }, adminToken)).status, 403);
});

test('product CRUD and orders require the correct role and orders are owner-scoped', async () => {
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/products', 'POST', product)).status, 401);
  assert.equal((await request('/products', 'POST', {} , adminToken)).status, 400);
  assert.equal((await request('/products', 'POST', { ...product, price: -1 }, adminToken)).status, 400);
  assert.equal((await request('/products', 'POST', { ...product, image: 'javascript:alert(1)' }, adminToken)).status, 400);
  assert.equal((await request('/products/bad-id')).status, 400);
  assert.equal((await request(`/products/${new mongoose.Types.ObjectId()}`)).status, 404);
  assert.equal((await request('/orders', 'POST', {})).status, 401);

  const created = await request('/products', 'POST', product, adminToken);
  assert.equal(created.status, 201);
  const id = created.body._id;
  assert.equal((await request(`/products/${id}`)).body.name, product.name);
  assert.equal((await request('/products')).body.length, 1);
  assert.equal((await request('/products?category=Phones')).body.length, 1);
  assert.equal((await request('/products?category=Computers')).body.length, 0);
  assert.equal((await request('/products?category=Unknown')).status, 400);
  assert.equal((await request(`/products/${id}`, 'PUT', { price: 40 }, adminToken)).body.price, 40);
  assert.equal((await request(`/products/${id}`, 'PUT', { price: -1 }, adminToken)).status, 400);
  assert.equal((await request(`/products/${new mongoose.Types.ObjectId()}`, 'PUT', { price: 40 }, adminToken)).status, 404);

  const invalidOrder = await request('/orders', 'POST', { customer: orderCustomer, items: [{ product: id, quantity: -1 }] }, customerToken);
  assert.equal(invalidOrder.status, 400);
  const firstOrder = await request('/orders', 'POST', { customer: orderCustomer, items: [{ product: id, quantity: 2 }], total: 1 }, customerToken);
  assert.equal(firstOrder.status, 201);
  assert.equal(firstOrder.body.total, 88);

  const secondOrder = await request('/orders', 'POST', {
    customer: { name: 'Other Customer', email: 'other@example.com', address: 'Other address' },
    items: [{ product: id, quantity: 1 }],
  }, otherCustomerToken);
  assert.equal(secondOrder.status, 201);

  const storedOrder = await Order.findById(firstOrder.body.id);
  assert.equal(storedOrder.user.toString(), customerId);
  assert.equal(storedOrder.items[0].product.toString(), id);
  assert.deepEqual(
    { name: storedOrder.items[0].name, price: storedOrder.items[0].price, quantity: storedOrder.items[0].quantity },
    { name: product.name, price: 40, quantity: 2 },
  );

  const customerOrders = await request('/orders', 'GET', undefined, customerToken);
  assert.equal(customerOrders.status, 200);
  assert.equal(customerOrders.body.length, 1);
  assert.equal(customerOrders.body[0]._id, firstOrder.body.id);
  assert.equal(customerOrders.body[0].createdAt !== undefined, true);

  const otherCustomerOrders = await request('/orders', 'GET', undefined, otherCustomerToken);
  assert.equal(otherCustomerOrders.body.length, 1);
  assert.equal(otherCustomerOrders.body[0]._id, secondOrder.body.id);

  const legacyOrder = await Order.create({
    customer: { name: 'Legacy', email: 'legacy@example.com', address: 'Legacy address' },
    items: [],
    subtotal: 0,
    shipping: 0,
    total: 0,
  });
  assert.equal((await request('/orders', 'GET', undefined, customerToken)).body.length, 1);
  const adminOrders = await request('/orders', 'GET', undefined, adminToken);
  assert.equal(adminOrders.status, 200);
  assert.equal(adminOrders.body.length, 3);
  assert.ok(adminOrders.body.some(order => order._id === String(legacyOrder._id)));

  const freeShipping = await request('/orders', 'POST', { customer: orderCustomer, items: [{ product: id, quantity: 3 }] }, customerToken);
  assert.equal(freeShipping.body.total, 120);
  assert.equal((await request(`/products/${id}`, 'DELETE', undefined, customerToken)).status, 403);
  assert.equal((await request(`/products/${id}`, 'DELETE', undefined, adminToken)).status, 200);
  assert.equal((await request(`/products/${id}`)).status, 404);
  assert.equal((await request('/orders', 'POST', { customer: orderCustomer, items: [{ product: id, quantity: 1 }] }, customerToken)).status, 404);
});

test('category URLs support direct loading and admin product CRUD accepts new categories', async () => {
  const { categoryPages } = await import('../../shared/categories.js');
  for (const page of categoryPages) {
    const response = await fetch(base.replace('/api', '') + `/category/${page.slug}`);
    assert.equal(response.status, 200, page.slug);
    assert.match(await response.text(), /<div id="root"><\/div>/);
  }
  assert.equal((await fetch(base.replace('/api', '') + '/category/unknown')).status, 404);
  for (const category of ['Gaming', 'Smart Home']) {
    const created = await request('/products', 'POST', { ...product, category }, adminToken);
    assert.equal(created.status, 201);
    assert.equal((await request(`/products/${created.body._id}`)).body.category, category);
    assert.equal((await request(`/products/${created.body._id}`, 'PUT', { category: 'Accessories' }, adminToken)).body.category, 'Accessories');
    await request(`/products/${created.body._id}`, 'DELETE', undefined, adminToken);
  }
  assert.equal((await request('/products', 'POST', { ...product, category: 'Unknown' }, adminToken)).status, 400);
  const { initialProducts } = await import('../seed-data.js');
  assert.deepEqual(new Set(initialProducts.map(item => item.category)), new Set(['Phones', 'Computers', 'Audio', 'Wearables', 'Accessories']));
});
