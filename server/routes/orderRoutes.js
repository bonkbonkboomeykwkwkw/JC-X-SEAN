import { Router } from 'express';
import {
  createOrder,
  getOrderHistory,
  getOrders,
  updateOrderPayment,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getOrders);
router.post('/', authenticate, requireRole('customer'), createOrder);
router.patch('/:id/status', authenticate, requireRole('admin'), updateOrderStatus);
router.patch('/:id/payment', authenticate, requireRole('admin'), updateOrderPayment);
router.get('/:id/history', authenticate, getOrderHistory);

export default router;
