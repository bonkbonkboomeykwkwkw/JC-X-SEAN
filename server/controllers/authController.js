import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret, JWT_AUDIENCE, JWT_ISSUER } from '../middleware/auth.js';

const passwordMinLength = 8;
const passwordMaxBytes = 72;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validPassword(password) {
  return typeof password === 'string'
    && password.length >= passwordMinLength
    && Buffer.byteLength(password, 'utf8') <= passwordMaxBytes;
}

function issueToken(user) {
  return jwt.sign({}, getJwtSecret(), {
    subject: String(user._id),
    expiresIn: '1h',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

function authResponse(user) {
  return {
    token: issueToken(user),
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function registerCustomer(req, res) {
  const { name, email, password } = req.body || {};
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedName || normalizedName.length > 100 || !emailPattern.test(normalizedEmail) || normalizedEmail.length > 254 || !validPassword(password)) {
    return res.status(400).json({ message: 'Provide a name, valid email, and password between 8 and 72 UTF-8 bytes' });
  }

  try {
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'customer',
    });
    return res.status(201).json(authResponse(user));
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    throw error;
  }
}

export async function loginCustomer(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !emailPattern.test(email.trim()) || !validPassword(password)) {
    return res.status(400).json({ message: 'A valid email and password are required' });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || user.role !== 'customer' || !passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  return res.json(authResponse(user));
}

export async function loginAdmin(req, res) {
  const { identity, password } = req.body || {};
  if (typeof identity !== 'string' || !identity.trim() || identity.trim().length > 254 || !validPassword(password)) {
    return res.status(400).json({ message: 'An email or username and password are required' });
  }

  const normalizedIdentity = identity.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: normalizedIdentity }, { username: normalizedIdentity }],
  }).select('+passwordHash');
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || user.role !== 'admin' || !passwordMatches) {
    return res.status(401).json({ message: 'Invalid administrator credentials' });
  }

  return res.json(authResponse(user));
}
