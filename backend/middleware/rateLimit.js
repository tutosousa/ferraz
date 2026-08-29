// Limitadores de taxa de requisições (rate limiting), para dificultar
// ataques de força bruta contra login, códigos de verificação e
// recuperação de senha. Sem isso, alguém poderia tentar milhares de
// senhas ou códigos de 6 dígitos por segundo.

const rateLimit = require('express-rate-limit');

// Login (admin ou cliente): no máximo 10 tentativas a cada 15 minutos,
// por endereço IP.
const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Verificação de código (cadastro, 2FA, recuperação de senha): um código
// de 6 dígitos tem 1 milhão de combinações — sem limite de tentativas,
// seria possível "adivinhar" por força bruta em pouco tempo.
const limitarCodigo = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Solicitação de novos códigos (reenviar / esqueci minha senha): evita que
// alguém spamme o e-mail de outra pessoa com códigos.
const limitarEnvioCodigo = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Muitos pedidos de código em pouco tempo. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { limitarLogin, limitarCodigo, limitarEnvioCodigo };
