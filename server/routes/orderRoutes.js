import { Router } from 'express';
import { createOrder, getOrders } from '../controllers/orderController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getOrders);
router.post('/', authenticate, requireRole('customer'), createOrder);

export default router;
