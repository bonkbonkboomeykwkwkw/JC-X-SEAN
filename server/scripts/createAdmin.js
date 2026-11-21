import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createInitialAdmin() {
  const name = process.env.INITIAL_ADMIN_NAME?.trim();
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!name || name.length > 100 || !emailPattern.test(email || '') || email.length > 254) {
    throw new Error('Set valid INITIAL_ADMIN_NAME and INITIAL_ADMIN_EMAIL values.');
  }
  if (username && !/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('INITIAL_ADMIN_USERNAME must be 3-32 letters, numbers, dots, underscores, or hyphens.');
  }
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('INITIAL_ADMIN_PASSWORD must be between 12 and 72 UTF-8 bytes.');
  }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/form-and-field', { serverSelectionTimeoutMS: 5000 });
  if (await User.exists({ role: 'admin' })) {
    throw new Error('An administrator already exists; initial admin creation is disabled.');
  }

  const admin = await User.create({
    name,
    email,
    ...(username ? { username } : {}),
    passwordHash: await bcrypt.hash(password, 12),
    role: 'admin',
  });
  console.log(`Created initial administrator ${admin.email}. Remove the INITIAL_ADMIN_* values from your environment.`);
}

try {
  await createInitialAdmin();
} catch (error) {
  console.error(`Admin initialization failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState) await mongoose.disconnect();
}
