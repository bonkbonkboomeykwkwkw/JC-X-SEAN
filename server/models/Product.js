import mongoose from 'mongoose';
import { categories } from '../../shared/categories.js';
export { categories };
function isValidImage(value) {
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    if (typeof value !== 'string' || !value.startsWith('/images/')) return false;
    try {
      const decoded = decodeURIComponent(value);
      return !decoded.includes('\\') && !decoded.split('/').includes('..') && /\.(?:jpe?g|png|webp|avif)$/i.test(decoded);
    } catch {
      return false;
    }
  }
}
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 100 },
  price: { type: Number, required: true, min: 0.01, max: 1000000 },
  category: { type: String, enum: categories, required: true },
  image: { type: String, required: true, validate: isValidImage },
  badge: { type: String, trim: true, maxlength: 30, default: '' },
}, { timestamps: true });
export default mongoose.model('Product', schema);
