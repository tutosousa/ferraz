// Middleware de autenticação do painel administrativo.
// Protege rotas exigindo um token JWT válido no cabeçalho Authorization.

const jwt = require('jsonwebtoken');

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acesso não informado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tipo !== 'admin') {
      return res.status(403).json({ error: 'Token inválido para esta operação.' });
    }
    req.admin = decoded; // { id, email, nome, tipo: 'admin' }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

module.exports = { requireAdminAuth };
