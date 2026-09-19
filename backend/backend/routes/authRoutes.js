const express = require('express');
const router = express.Router();
const { login, me, esqueciSenha, redefinirSenha } = require('../controllers/authController');
const { requireAdminAuth } = require('../middleware/auth');
const { limitarLogin, limitarCodigo, limitarEnvioCodigo } = require('../middleware/rateLimit');

router.post('/login', limitarLogin, login);
router.get('/me', requireAdminAuth, me);
router.post('/esqueci-senha', limitarEnvioCodigo, esqueciSenha);
router.post('/redefinir-senha', limitarCodigo, redefinirSenha);

module.exports = router;
