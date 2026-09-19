const express = require('express');
const router = express.Router();
const { getConfig, processarPagamento, receberWebhook } = require('../controllers/paymentController');

// Configuração pública (Public Key) para o Payment Brick no frontend
router.get('/config', getConfig);

// Processa o pagamento vindo do checkout invisível (Payment Brick)
router.post('/processar', processarPagamento);

// Endpoint público chamado pelo próprio Mercado Pago (não pelo navegador
// do cliente) para avisar sobre mudanças assíncronas no status do pagamento
router.post('/webhook', receberWebhook);
router.get('/webhook', receberWebhook);

module.exports = router;
