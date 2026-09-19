const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const {
  conectar,
  callback,
  status,
  desconectarConta,
} = require('../controllers/melhorEnvioController');

router.get('/melhor-envio/conectar', conectar);
router.get('/melhor-envio/callback', callback);
router.get('/melhor-envio/status', requireAdminAuth, status);
router.post('/melhor-envio/desconectar', requireAdminAuth, desconectarConta);

module.exports = router;
