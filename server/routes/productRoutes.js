import { Router } from 'express';
import mongoose from 'mongoose';
import { createProduct, deleteProduct, getProduct, getProducts, updateProduct } from '../controllers/productController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.param('id', (req, res, next, id) => mongoose.isObjectIdOrHexString(id) ? next() : res.status(400).json({ message: 'Invalid product ID' }));
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', authenticate, requireRole('admin'), createProduct);
router.put('/:id', authenticate, requireRole('admin'), updateProduct);
router.delete('/:id', authenticate, requireRole('admin'), deleteProduct);

export default router;
