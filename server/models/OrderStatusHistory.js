import mongoose from 'mongoose';
import { ORDER_STATUSES } from './Order.js';

const schema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  previousStatus: { type: String, enum: ORDER_STATUSES, default: null },
  newStatus: { type: String, enum: ORDER_STATUSES, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, trim: true, maxlength: 500 },
}, { timestamps: { createdAt: true, updatedAt: false } });

schema.index({ orderId: 1, createdAt: 1 });

export default mongoose.model('OrderStatusHistory', schema);
