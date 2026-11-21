import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const [{ app }, { getJwtSecret }] = await Promise.all([
  import('./server/app.js'),
  import('./server/middleware/auth.js'),
]);

const port = Number(process.env.PORT || 5000);
try {
  getJwtSecret();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/form-and-field', { serverSelectionTimeoutMS: 5000 });
  const server = app.listen(port, '127.0.0.1', () => console.log(`API running at http://localhost:${port}`));
  server.on('error', error => { console.error(error.message); mongoose.disconnect().finally(() => process.exit(1)); });
  const shutdown = () => server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('MongoDB connection failed. Start MongoDB locally or set MONGODB_URI in .env.');
  console.error(error.message);
  process.exit(1);
}
