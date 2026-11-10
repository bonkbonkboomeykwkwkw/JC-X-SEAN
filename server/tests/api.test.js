import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../app.js';
import Order from '../models/Order.js';
let database, server, base;
before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (database) await database.stop(); });
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
const product = { name: 'Test vase', description: 'Ceramic', price: 30, category: 'Objects', image: 'https://example.com/vase.jpg' };
test('product CRUD persists and validates input; orders use database prices', async () => {
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/products', 'POST', { ...product, price: -1 })).status, 400);
  assert.equal((await request('/products', 'POST', { ...product, image: 'javascript:alert(1)' })).status, 400);
  assert.equal((await request('/products/bad-id')).status, 400);
  const created = await request('/products', 'POST', product);
  assert.equal(created.status, 201);
  const id = created.body._id;
  assert.equal((await request(`/products/${id}`)).body.name, product.name);
  assert.equal((await request('/products')).body.length, 1);
  assert.equal((await request(`/products/${id}`, 'PUT', { price: 40 })).body.price, 40);
  const customer = { name: 'Test Customer', email: 'test@example.com', address: 'Test address' };
  assert.equal((await request('/orders', 'POST', { customer, items: [{ product: id, quantity: -1 }] })).status, 400);
  const order = await request('/orders', 'POST', { customer, items: [{ product: id, quantity: 2 }], total: 1 });
  assert.equal(order.status, 201);
  assert.equal(order.body.total, 88);
  assert.equal((await Order.findById(order.body.id)).items[0].price, 40);
  const freeShipping = await request('/orders', 'POST', { customer, items: [{ product: id, quantity: 3 }] });
  assert.equal(freeShipping.body.total, 120);
  assert.equal((await request(`/products/${id}`, 'DELETE')).status, 200);
  assert.equal((await request(`/products/${id}`)).status, 404);
  assert.equal((await request('/orders', 'POST', { customer, items: [{ product: id, quantity: 1 }] })).status, 409);
});

test('category URLs support direct loading and product CRUD accepts new categories', async () => {
  const { categoryPages } = await import('../../shared/categories.js');
  for (const page of categoryPages) {
    const response = await fetch(base.replace('/api', '') + `/category/${page.slug}`);
    assert.equal(response.status, 200, page.slug);
    assert.match(await response.text(), /<div id="root"><\/div>/);
  }
  assert.equal((await fetch(base.replace('/api', '') + '/category/unknown')).status, 404);
  for (const category of ['Sports', 'Furniture']) {
    const created = await request('/products', 'POST', { ...product, category });
    assert.equal(created.status, 201);
    assert.equal((await request(`/products/${created.body._id}`)).body.category, category);
    assert.equal((await request(`/products/${created.body._id}`, 'PUT', { category: 'Kitchen' })).body.category, 'Kitchen');
    await request(`/products/${created.body._id}`, 'DELETE');
  }
  assert.equal((await request('/products', 'POST', { ...product, category: 'Unknown' })).status, 400);
});
