import { Router } from 'express';
import mongoose from 'mongoose';
import { createProduct, deleteProduct, getProduct, getProducts, updateProduct } from '../controllers/productController.js';

const router = Router();

router.param('id', (req, res, next, id) => mongoose.isObjectIdOrHexString(id) ? next() : res.status(400).json({ message: 'Invalid product ID' }));
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
