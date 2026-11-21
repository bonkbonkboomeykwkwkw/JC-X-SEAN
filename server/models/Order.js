import mongoose from 'mongoose';

export const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Cancelled'];

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  customer: { name: String, email: String, address: String },
  items: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, name: String, price: Number, quantity: Number }],
  subtotal: Number,
  shipping: Number,
  total: Number,
  status: {
    type: String,
    enum: ORDER_STATUSES,
    default: function () { return this.isNew ? 'Pending' : undefined; },
  },
  paymentMethod: {
    type: String,
    enum: ['COD'],
    default: function () { return this.isNew ? 'COD' : undefined; },
  },
  paymentStatus: {
    type: String,
    enum: PAYMENT_STATUSES,
    default: function () { return this.isNew ? 'Pending' : undefined; },
  },
  contactNumber: {
    type: String,
    trim: true,
    validate: {
      validator: value => value === undefined || value === null
        || (value.length >= 7 && value.length <= 20
          && /^[+]?[\d\s().-]+$/.test(value)
          && (value.match(/\d/g) || []).length >= 7
          && (value.match(/\d/g) || []).length <= 15),
      message: 'Contact number must contain 7 to 15 digits and be at most 20 characters',
    },
  },
  shippingAddress: { type: String, required: true, trim: true, maxlength: 500 },
}, { timestamps: true });

export default mongoose.model('Order', schema);
