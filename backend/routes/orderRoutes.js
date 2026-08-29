const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const { attachCustomerIfPresent } = require('../middleware/customerAuth');
const {
  createOrder,
  getOrderByNumber,
  getShippingQuote,
  listOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orderController');

// Pública (checkout / confirmação) — attachCustomerIfPresent detecta se o
// comprador está logado, sem obrigar login (permite compra como visitante).
router.post('/frete', getShippingQuote);
router.post('/', attachCustomerIfPresent, createOrder);
router.get('/numero/:numero', getOrderByNumber);

// Admin
router.get('/admin/all', requireAdminAuth, listOrders);
router.get('/admin/:id', requireAdminAuth, getOrderById);
router.patch('/admin/:id/status', requireAdminAuth, updateOrderStatus);

module.exports = router;
