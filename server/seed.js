import 'dotenv/config';
import mongoose from 'mongoose';
import Product from './models/Product.js';
import { initialProducts } from './seed-data.js';
try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/form-and-field', { serverSelectionTimeoutMS: 5000 });
  if (await Product.exists({})) console.log('Products already exist. Seed skipped to preserve your data.');
  else { await Product.insertMany(initialProducts); console.log('Added 8 starter products.'); }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
