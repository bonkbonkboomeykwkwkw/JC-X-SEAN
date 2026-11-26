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
import { seedCatalog } from '../seedCatalog.js';

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
  const localImageProduct = await request('/products', 'POST', { ...product, image: '/images/samsunggalaxy.webp' }, adminToken);
  assert.equal(localImageProduct.status, 201);
  assert.equal((await request('/products', 'POST', { ...product, image: '/images/%2e%2e/server.js' }, adminToken)).status, 400);
  await request(`/products/${localImageProduct.body._id}`, 'DELETE', undefined, adminToken);
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

  const legacyOrderId = new mongoose.Types.ObjectId();
  await Order.collection.insertOne({
    _id: legacyOrderId,
    status: 'demo',
    customer: { name: 'Legacy', email: 'legacy@example.com', address: 'Legacy address' },
    items: [],
    subtotal: 0,
    shipping: 0,
    total: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal((await request('/orders', 'GET', undefined, customerToken)).body.length, 1);
  const adminOrders = await request('/orders', 'GET', undefined, adminToken);
  assert.equal(adminOrders.status, 200);
  assert.equal(adminOrders.body.length, 3);
  assert.ok(adminOrders.body.some(order => order._id === String(legacyOrderId)));

  const freeShipping = await request('/orders', 'POST', { customer: orderCustomer, items: [{ product: id, quantity: 3 }] }, customerToken);
  assert.equal(freeShipping.body.total, 120);
  assert.equal((await request(`/products/${id}`, 'DELETE', undefined, customerToken)).status, 403);
  assert.equal((await request(`/products/${id}`, 'DELETE', undefined, adminToken)).status, 200);
  assert.equal((await request(`/products/${id}`)).status, 404);
  assert.equal((await request('/orders', 'POST', { customer: orderCustomer, items: [{ product: id, quantity: 1 }] }, customerToken)).status, 404);
});

test('category URLs support direct loading and admin product CRUD accepts new categories', async () => {
  for (const adminPath of ['/admin', '/admin/login', '/admin/orders', '/admin/products']) {
    const response = await fetch(base.replace('/api', '') + adminPath);
    assert.equal(response.status, 200, adminPath);
    assert.match(await response.text(), /<div id="root"><\/div>/);
  }
  assert.equal((await fetch(base.replace('/api', '') + '/admin/unknown')).status, 404);
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
  const { categories } = await import('../../shared/categories.js');
  assert.deepEqual(new Set(initialProducts.map(item => item.category)), new Set(categories));
  assert.equal(new Set(initialProducts.map(item => item.name)).size, initialProducts.length);
  for (const item of initialProducts) {
    assert.ok(item.name && item.description && item.price > 0 && categories.includes(item.category));
    assert.ok(item.image.startsWith('/images/'));
    const imageResponse = await fetch(base.replace('/api', '') + item.image);
    assert.equal(imageResponse.status, 200, item.image);
  }
});

test('order lifecycle records status history, restricts access, and tracks COD payment', async () => {
  const createdProduct = await request('/products', 'POST', { ...product, name: 'Lifecycle gadget' }, adminToken);
  assert.equal(createdProduct.status, 201);

  assert.equal((await request('/orders', 'POST', {
    customer: orderCustomer,
    items: [{ product: createdProduct.body._id, quantity: 1 }],
    contactNumber: '123-456',
  }, customerToken)).status, 400);
  assert.equal((await request('/orders', 'POST', {
    customer: orderCustomer,
    items: [{ product: createdProduct.body._id, quantity: 1 }],
    paymentMethod: 'GCash',
  }, customerToken)).status, 400);

  const completeAddress = '123 Rizal Street, Barangay San Antonio, Makati City, Metro Manila, National Capital Region (NCR)';
  const createdOrder = await request('/orders', 'POST', {
    customer: { ...orderCustomer, address: completeAddress },
    items: [{ product: createdProduct.body._id, quantity: 1 }],
    contactNumber: '+63 917 123 4567',
  }, customerToken);
  assert.equal(createdOrder.status, 201);
  const orderId = createdOrder.body.id;
  const storedOrder = await Order.findById(orderId).lean();
  assert.equal(storedOrder.status, 'Pending');
  assert.equal(storedOrder.paymentMethod, 'COD');
  assert.equal(storedOrder.paymentStatus, 'Pending');
  assert.equal(storedOrder.contactNumber, '+63 917 123 4567');
  assert.equal(storedOrder.shippingAddress, completeAddress);
  assert.equal(storedOrder.customer.address, completeAddress);
  const savedOrders = await request('/orders', 'GET', undefined, customerToken);
  assert.equal(savedOrders.body.find(order => order._id === orderId).shippingAddress, completeAddress);

  let history = await request(`/orders/${orderId}/history`, 'GET', undefined, customerToken);
  assert.equal(history.status, 200);
  assert.equal(history.body.length, 1);
  assert.equal(history.body[0].previousStatus, null);
  assert.equal(history.body[0].newStatus, 'Pending');
  assert.equal(history.body[0].changedBy, customerId);

  assert.equal((await request(`/orders/${orderId}/status`, 'PATCH', { status: 'Processing' }, customerToken)).status, 403);
  assert.equal((await request(`/orders/${orderId}/payment`, 'PATCH', { paymentStatus: 'Paid' }, customerToken)).status, 403);
  assert.equal((await request(`/orders/${orderId}/history`, 'GET', undefined, otherCustomerToken)).status, 404);
  assert.equal((await request(`/orders/${orderId}/payment`, 'PATCH', { paymentStatus: 'Paid' }, adminToken)).status, 409);
  assert.equal((await request(`/orders/${orderId}/status`, 'PATCH', { status: 'Shipped' }, adminToken)).status, 409);
  assert.equal((await request(`/orders/${orderId}/status`, 'PATCH', { status: 'Unknown' }, adminToken)).status, 400);

  const processing = await request(`/orders/${orderId}/status`, 'PATCH', { status: 'Processing', note: 'Order confirmed' }, adminToken);
  assert.equal(processing.status, 200);
  assert.equal(processing.body.status, 'Processing');
  assert.equal((await request(`/orders/${orderId}/status`, 'PATCH', { status: 'Pending' }, adminToken)).status, 409);
  assert.equal((await request(`/orders/${orderId}/status`, 'PATCH', { status: 'Shipped' }, adminToken)).status, 200);
  assert.equal((await request(`/orders/${orderId}/status`, 'PATCH', { status: 'Delivered' }, adminToken)).status, 200);

  const deliveredOrder = await Order.findById(orderId).lean();
  assert.equal(deliveredOrder.status, 'Delivered');
  assert.equal(deliveredOrder.paymentStatus, 'Pending');
  const paid = await request(`/orders/${orderId}/payment`, 'PATCH', { paymentStatus: 'Paid' }, adminToken);
  assert.equal(paid.status, 200);
  assert.equal(paid.body.paymentStatus, 'Paid');
  assert.equal((await request(`/orders/${orderId}/status`, 'PATCH', { status: 'Cancelled' }, adminToken)).status, 409);

  history = await request(`/orders/${orderId}/history`, 'GET', undefined, adminToken);
  assert.equal(history.status, 200);
  assert.deepEqual(history.body.map(entry => [entry.previousStatus, entry.newStatus]), [
    [null, 'Pending'],
    ['Pending', 'Processing'],
    ['Processing', 'Shipped'],
    ['Shipped', 'Delivered'],
  ]);
  assert.equal(history.body[1].changedBy, (await User.findOne({ role: 'admin' })).id);
  assert.equal(history.body[1].note, 'Order confirmed');

  const cancelledOrder = await request('/orders', 'POST', {
    customer: orderCustomer,
    items: [{ product: createdProduct.body._id, quantity: 1 }],
  }, customerToken);
  assert.equal(cancelledOrder.status, 201);
  assert.equal((await request(`/orders/${cancelledOrder.body.id}/status`, 'PATCH', { status: 'Cancelled' }, adminToken)).status, 200);
  const cancelledPayment = await request(`/orders/${cancelledOrder.body.id}/payment`, 'PATCH', { paymentStatus: 'Paid' }, adminToken);
  assert.equal(cancelledPayment.status, 409);
  assert.match(cancelledPayment.body.message, /Cancelled orders/);
  assert.equal((await request(`/orders/${cancelledOrder.body.id}/payment`, 'PATCH', { paymentStatus: 'Cancelled' }, adminToken)).status, 200);
  assert.equal((await Order.findById(cancelledOrder.body.id).lean()).paymentStatus, 'Cancelled');

  const legacyId = new mongoose.Types.ObjectId();
  await Order.collection.insertOne({
    _id: legacyId,
    user: new mongoose.Types.ObjectId(customerId),
    customer: orderCustomer,
    items: [],
    subtotal: 0,
    shipping: 0,
    total: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const legacyHistory = await request(`/orders/${legacyId}/history`, 'GET', undefined, customerToken);
  assert.equal(legacyHistory.status, 200);
  assert.deepEqual(legacyHistory.body, []);
  assert.equal((await request(`/orders/${legacyId}/status`, 'PATCH', { status: 'Processing' }, adminToken)).status, 409);
  const unchangedLegacy = await Order.collection.findOne({ _id: legacyId });
  assert.equal(Object.hasOwn(unchangedLegacy, 'status'), false);

  assert.equal((await request(`/orders/${new mongoose.Types.ObjectId()}/history`, 'GET', undefined, adminToken)).status, 404);
  assert.equal((await request('/orders/not-an-id/history', 'GET', undefined, adminToken)).status, 400);
});

test('catalog seeding removes only named retired products and populates every category', async () => {
  const starter = await Product.create({ ...product, name: 'Nova Phone Pro' });
  const custom = await Product.create({ ...product, name: 'Customer-created gadget' });
  const legacyFurniture = await Product.collection.insertOne({
    ...product,
    name: 'Arc Lounge Chair',
    category: 'Living',
  });
  const legacyDaypack = await Product.collection.insertOne({
    ...product,
    name: 'Trail Daypack',
    category: 'Sports',
  });
  const existingOrder = await Order.findOne();
  const usersBefore = await User.countDocuments();

  const seeded = await seedCatalog();

  assert.equal(seeded.seededCount, 14);
  assert.equal(seeded.removedCount, 3);
  assert.equal(await Product.findById(starter._id), null);
  assert.equal(await Product.collection.findOne({ _id: legacyFurniture.insertedId }), null);
  assert.equal(await Product.collection.findOne({ _id: legacyDaypack.insertedId }), null);
  assert.ok(await Product.findById(custom._id));
  assert.ok(await Order.findById(existingOrder._id));
  assert.equal(await User.countDocuments(), usersBefore);

  const { initialProducts } = await import('../seed-data.js');
  const seededNames = initialProducts.map(item => item.name);
  assert.equal(await Product.countDocuments({ name: { $in: seededNames } }), initialProducts.length);
  assert.equal((await request('/products?category=Gaming')).body.length, 2);
  assert.equal((await request('/products?category=Smart%20Home')).body.length, 2);
});
