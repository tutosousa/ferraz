const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const { conectar, callback, status, desconectarConta } = require('../controllers/melhorEnvioController');

// Início da autorização (navegação de página, verifica o token de admin
// manualmente já que não dá pra mandar cabeçalho Authorization numa
// navegação simples do navegador — veja o controller)
router.get('/melhor-envio/conectar', conectar);

// O próprio Melhor Envio chama esta rota (não é o navegador do admin
// diretamente) — precisa ficar pública.
router.get('/melhor-envio/callback', callback);

// Consultar/encerrar a conexão (aqui sim dá pra exigir o cabeçalho normal,
// já que são chamadas via fetch/JS, não navegação de página)
router.get('/melhor-envio/status', requireAdminAuth, status);
router.post('/melhor-envio/desconectar', requireAdminAuth, desconectarConta);

module.exports = router;
