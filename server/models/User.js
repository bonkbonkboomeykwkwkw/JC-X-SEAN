import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  username: {
    type: String,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 32,
    match: /^[a-z0-9._-]+$/,
    unique: true,
    sparse: true,
  },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer', required: true },
}, { timestamps: true });

export default mongoose.model('User', schema);
