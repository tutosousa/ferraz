const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const { requireCustomerAuth } = require('../middleware/customerAuth');
const {
  createOrder,
  getOrderByNumber,
  getShippingQuote,
  listOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orderController');

// Checkout agora EXIGE login do cliente (não é mais permitido comprar como
// visitante) — requireCustomerAuth barra a requisição com 401 se não vier
// um token de cliente válido.
router.post('/frete', getShippingQuote);
router.post('/', requireCustomerAuth, createOrder);
router.get('/numero/:numero', getOrderByNumber);

// Admin
router.get('/admin/all', requireAdminAuth, listOrders);
router.get('/admin/:id', requireAdminAuth, getOrderById);
router.patch('/admin/:id/status', requireAdminAuth, updateOrderStatus);

module.exports = router;
