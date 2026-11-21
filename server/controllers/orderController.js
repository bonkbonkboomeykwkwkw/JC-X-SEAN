import mongoose from 'mongoose';
import Order, { ORDER_STATUSES } from '../models/Order.js';
import OrderStatusHistory from '../models/OrderStatusHistory.js';
import Product from '../models/Product.js';

const allowedTransitions = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validContactNumber(value) {
  return typeof value === 'string'
    && value.trim().length >= 7
    && value.trim().length <= 20
    && /^[+]?[\d\s().-]+$/.test(value.trim())
    && (value.match(/\d/g) || []).length >= 7
    && (value.match(/\d/g) || []).length <= 15;
}

async function transactionsSupported() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  return Boolean(hello.setName || hello.msg === 'isdbgrid');
}

async function writeWithOrderHistory(transactionWrite, fallbackWrite) {
  if (!await transactionsSupported()) return fallbackWrite();

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => transactionWrite(session));
  } finally {
    await session.endSession();
  }
}

async function createOrderWithHistory(orderData, changedBy) {
  const transactionWrite = async session => {
    const [order] = await Order.create([orderData], { session });
    await OrderStatusHistory.create([{
      orderId: order._id,
      previousStatus: null,
      newStatus: order.status,
      changedBy,
      note: 'Order placed',
    }], { session });
    return order;
  };

  const fallbackWrite = async () => {
    const order = await Order.create(orderData);
    try {
      await OrderStatusHistory.create({
        orderId: order._id,
        previousStatus: null,
        newStatus: order.status,
        changedBy,
        note: 'Order placed',
      });
      return order;
    } catch (writeError) {
      try {
        await OrderStatusHistory.deleteMany({ orderId: order._id });
        await Order.deleteOne({ _id: order._id });
      } catch (rollbackError) {
        throw new AggregateError([writeError, rollbackError], 'Order creation failed and cleanup was incomplete');
      }
      throw writeError;
    }
  };

  return writeWithOrderHistory(transactionWrite, fallbackWrite);
}

async function changeOrderStatus(orderId, status, changedBy, note) {
  const applyChange = async session => {
    const options = session ? { session } : {};
    const rawOrder = await Order.collection.findOne({ _id: orderId }, options);
    if (!rawOrder) throw httpError(404, 'Order not found');
    if (typeof rawOrder.status !== 'string' || !ORDER_STATUSES.includes(rawOrder.status)) {
      throw httpError(409, 'This legacy order status cannot be transitioned');
    }
    if (!allowedTransitions[rawOrder.status].includes(status)) {
      throw httpError(409, `Cannot transition an order from ${rawOrder.status} to ${status}`);
    }

    const previousStatus = rawOrder.status;
    const order = await Order.findOneAndUpdate(
      { _id: orderId, status: previousStatus },
      { $set: { status } },
      { new: true, runValidators: true, ...options },
    );
    if (!order) throw httpError(409, 'Order status changed concurrently; reload and retry');

    const history = new OrderStatusHistory({
      orderId,
      previousStatus,
      newStatus: status,
      changedBy,
      note: note || undefined,
    });

    if (session) {
      await history.save({ session });
      return order;
    }

    try {
      await history.save();
      return order;
    } catch (writeError) {
      try {
        const rollback = await Order.updateOne(
          { _id: orderId, status },
          { $set: { status: previousStatus } },
          { runValidators: true },
        );
        if (rollback.modifiedCount !== 1) throw new Error('Order status could not be restored');
        await OrderStatusHistory.deleteOne({ _id: history._id });
      } catch (rollbackError) {
        throw new AggregateError([writeError, rollbackError], 'Status update failed and cleanup was incomplete');
      }
      throw writeError;
    }
  };

  return writeWithOrderHistory(
    session => applyChange(session),
    () => applyChange(undefined),
  );
}

export async function createOrder(req, res) {
  const body = req.body || {};
  const { customer, items } = body;
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)
    || !['name', 'email', 'address'].every(key => typeof customer[key] === 'string' && customer[key].trim() && customer[key].length <= 500)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
    return res.status(400).json({ message: 'Valid customer name, email and shipping address are required' });
  }
  if (!Array.isArray(items) || !items.length || items.length > 100
    || items.some(item => !item || !mongoose.isObjectIdOrHexString(item.product) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)
    || new Set(items.map(item => item.product)).size !== items.length) {
    return res.status(400).json({ message: 'Provide unique products with quantities between 1 and 99' });
  }

  const shippingAddress = body.shippingAddress === undefined ? customer.address : body.shippingAddress;
  if (typeof shippingAddress !== 'string' || !shippingAddress.trim() || shippingAddress.length > 500) {
    return res.status(400).json({ message: 'A valid shipping address is required' });
  }
  const contactNumber = body.contactNumber ?? customer.contactNumber ?? customer.phone;
  if (contactNumber !== undefined && !validContactNumber(contactNumber)) {
    return res.status(400).json({ message: 'Contact number must contain 7 to 15 digits and be at most 20 characters' });
  }
  if (body.paymentMethod !== undefined && body.paymentMethod !== 'COD') {
    return res.status(400).json({ message: 'Only COD payment is supported' });
  }

  const products = await Product.find({ _id: { $in: items.map(item => item.product) } });
  if (products.length !== items.length) return res.status(404).json({ message: 'A product is no longer available. Refresh your bag.' });
  const orderItems = items.map(item => {
    const product = products.find(candidate => String(candidate._id) === item.product);
    return { product: product._id, name: product.name, price: product.price, quantity: item.quantity };
  });
  const cents = orderItems.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0);
  const shipping = cents >= 10000 ? 0 : 8;
  const order = await createOrderWithHistory({
    user: req.user._id,
    customer: { name: customer.name.trim(), email: customer.email.trim(), address: customer.address.trim() },
    items: orderItems,
    subtotal: cents / 100,
    shipping,
    total: cents / 100 + shipping,
    status: 'Pending',
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    contactNumber: contactNumber?.trim(),
    shippingAddress: shippingAddress.trim(),
  }, req.user._id);

  res.status(201).json({ id: order._id, total: order.total, status: order.status });
}

export async function getOrders(req, res) {
  const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
  res.json(await Order.find(filter).sort({ createdAt: -1 }));
}

export async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status, note } = req.body || {};
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: 'Invalid order ID' });
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });
  }
  if (note !== undefined && (typeof note !== 'string' || note.length > 500)) {
    return res.status(400).json({ message: 'Status note must be a string of at most 500 characters' });
  }

  const order = await changeOrderStatus(new mongoose.Types.ObjectId(id), status, req.user._id, note?.trim());
  res.json({ id: order._id, status: order.status });
}

export async function updateOrderPayment(req, res) {
  const { id } = req.params;
  const { paymentStatus } = req.body || {};
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: 'Invalid order ID' });
  if (!['Paid', 'Cancelled'].includes(paymentStatus)) {
    return res.status(400).json({ message: 'Payment status must be Paid or Cancelled' });
  }

  const orderId = new mongoose.Types.ObjectId(id);
  const rawOrder = await Order.collection.findOne({ _id: orderId });
  if (!rawOrder) return res.status(404).json({ message: 'Order not found' });
  if (rawOrder.paymentMethod !== 'COD' || !rawOrder.paymentStatus) {
    return res.status(409).json({ message: 'This legacy order does not have COD payment tracking' });
  }
  if (paymentStatus === 'Paid' && rawOrder.status === 'Cancelled') {
    return res.status(409).json({ message: 'Cancelled orders cannot be marked Paid' });
  }
  if (paymentStatus === 'Paid' && rawOrder.status !== 'Delivered') {
    return res.status(409).json({ message: 'Payment can only be marked Paid after delivery' });
  }
  if (paymentStatus === 'Cancelled' && rawOrder.status !== 'Cancelled') {
    return res.status(409).json({ message: 'Payment can only be cancelled for a cancelled order' });
  }
  if (rawOrder.paymentStatus === paymentStatus) {
    return res.json({ id: rawOrder._id, paymentMethod: rawOrder.paymentMethod, paymentStatus: rawOrder.paymentStatus });
  }
  if (rawOrder.paymentStatus !== 'Pending') {
    return res.status(409).json({ message: 'Payment status cannot change from its current value' });
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: rawOrder.status, paymentMethod: 'COD', paymentStatus: 'Pending' },
    { $set: { paymentStatus } },
    { new: true, runValidators: true },
  );
  if (!order) return res.status(409).json({ message: 'Order payment changed concurrently; reload and retry' });
  res.json({ id: order._id, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus });
}

export async function getOrderHistory(req, res) {
  const { id } = req.params;
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: 'Invalid order ID' });

  const filter = { _id: id };
  if (req.user.role !== 'admin') filter.user = req.user._id;
  const order = await Order.findOne(filter).select('_id').lean();
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const history = await OrderStatusHistory.find({ orderId: order._id })
    .select('_id orderId previousStatus newStatus changedBy note createdAt')
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  res.json(history);
}
