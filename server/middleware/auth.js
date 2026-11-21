import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const JWT_ISSUER = 'jc-x-sean';
export const JWT_AUDIENCE = 'jc-x-sean-api';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes.');
  }
  return secret;
}

export async function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) return res.status(401).json({ message: 'A bearer token is required' });

  let payload;
  try {
    payload = jwt.verify(match[1], getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  } catch (error) {
    return res.status(401).json({
      message: error.name === 'TokenExpiredError' ? 'Authentication token expired' : 'Invalid authentication token',
    });
  }

  if (!payload || typeof payload.sub !== 'string') {
    return res.status(401).json({ message: 'Invalid authentication token' });
  }

  const user = await User.findById(payload.sub).select('_id role');
  if (!user) return res.status(401).json({ message: 'Authentication account no longer exists' });

  req.user = user;
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ message: 'You are not authorized to perform this action' });
    next();
  };
}
