const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const { requireCustomerAuth } = require('../middleware/customerAuth');
const {
  createOrder,
  getOrderByNumber,
  listOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orderController');

// Checkout exige login do cliente — requireCustomerAuth barra a requisição
// com 401 se não vier um token de cliente válido.
router.post('/', requireCustomerAuth, createOrder);
router.get('/numero/:numero', getOrderByNumber);

// Admin
router.get('/admin/all', requireAdminAuth, listOrders);
router.get('/admin/:id', requireAdminAuth, getOrderById);
router.patch('/admin/:id/status', requireAdminAuth, updateOrderStatus);

module.exports = router;
