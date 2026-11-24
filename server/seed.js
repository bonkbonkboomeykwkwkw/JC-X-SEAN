import 'dotenv/config';
import mongoose from 'mongoose';
import { seedCatalog } from './seedCatalog.js';
try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/form-and-field', { serverSelectionTimeoutMS: 5000 });
  const result = await seedCatalog();
  console.log(`Seeded ${result.seededCount} technology products; removed ${result.removedCount} retired seed products.`);
} catch (error) { console.error(`Seeding failed: ${error.message}`); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
