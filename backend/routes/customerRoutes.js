const express = require('express');
const router = express.Router();
const { requireCustomerAuth } = require('../middleware/customerAuth');
const { limitarLogin, limitarCodigo, limitarEnvioCodigo } = require('../middleware/rateLimit');
const {
  cadastrar,
  verificarCadastro,
  reenviarCodigoCadastro,
  login,
  verificarLogin,
  reenviarCodigoLogin,
  meuPerfil,
  atualizarPerfil,
  meusPedidos,
  esqueciSenha,
  redefinirSenha,
} = require('../controllers/customerAuthController');

// Cadastro (com confirmação de e-mail em duas etapas)
router.post('/cadastro', limitarLogin, cadastrar);
router.post('/cadastro/verificar', limitarCodigo, verificarCadastro);
router.post('/cadastro/reenviar-codigo', limitarEnvioCodigo, reenviarCodigoCadastro);

// Login em duas etapas (senha + código de acesso por e-mail)
router.post('/login', limitarLogin, login);
router.post('/login/verificar', limitarCodigo, verificarLogin);
router.post('/login/reenviar-codigo', limitarEnvioCodigo, reenviarCodigoLogin);

// Recuperação de senha
router.post('/esqueci-senha', limitarEnvioCodigo, esqueciSenha);
router.post('/redefinir-senha', limitarCodigo, redefinirSenha);

// Perfil / pedidos (exige sessão já confirmada)
router.get('/perfil', requireCustomerAuth, meuPerfil);
router.put('/perfil', requireCustomerAuth, atualizarPerfil);
router.get('/meus-pedidos', requireCustomerAuth, meusPedidos);

module.exports = router;
