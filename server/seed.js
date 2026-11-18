import 'dotenv/config';
import mongoose from 'mongoose';
import Product from './models/Product.js';
import { initialProducts } from './seed-data.js';
try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/form-and-field', { serverSelectionTimeoutMS: 5000 });
  await Product.bulkWrite(initialProducts.map(product => ({
    updateOne: { filter: { name: product.name }, update: { $set: product }, upsert: true },
  })));
  console.log(`Seeded ${initialProducts.length} starter products.`);
} catch (error) { console.error(`Seeding failed: ${error.message}`); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
