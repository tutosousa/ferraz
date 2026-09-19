// Middleware de autenticação de CLIENTES da loja (separado do admin).
// Protege rotas que exigem que o comprador esteja logado, como
// "meus pedidos" e "meu perfil".

const jwt = require('jsonwebtoken');

function requireCustomerAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Você precisa entrar na sua conta para continuar.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tipo !== 'cliente') {
      return res.status(403).json({ error: 'Token inválido para esta operação.' });
    }
    req.cliente = decoded; // { id, email, nome, tipo: 'cliente' }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

// Versão "opcional": se vier um token de cliente válido, anexa req.cliente;
// caso contrário, segue em frente normalmente (usado no checkout, que
// aceita tanto compra como visitante quanto compra logado).
function attachCustomerIfPresent(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.tipo === 'cliente') {
        req.cliente = decoded;
      }
    } catch (err) {
      // token inválido/expirado: apenas ignora e segue como visitante
    }
  }
  next();
}

module.exports = { requireCustomerAuth, attachCustomerIfPresent };
