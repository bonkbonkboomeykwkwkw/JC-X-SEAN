import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  customer: { name: String, email: String, address: String },
  items: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, name: String, price: Number, quantity: Number }],
  subtotal: Number,
  shipping: Number,
  total: Number,
  status: { type: String, default: 'demo' },
}, { timestamps: true });
export default mongoose.model('Order', schema);
