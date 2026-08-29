// Autenticação do painel administrativo.
// Login com e-mail + senha; a senha é comparada com o hash bcrypt salvo no banco.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { solicitarRecuperacao, redefinirSenhaComCodigo } = require('../services/passwordReset');

async function login(req, res, next) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const [rows] = await pool.query(
      'SELECT id, nome, email, senha_hash FROM admins WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      // Mensagem genérica de propósito: não revelar se o e-mail existe ou não.
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const admin = rows[0];
    const senhaCorreta = await bcrypt.compare(senha, admin.senha_hash);

    if (!senhaCorreta) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, nome: admin.nome, tipo: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      admin: { id: admin.id, nome: admin.nome, email: admin.email },
    });
  } catch (err) {
    next(err);
  }
}

// Retorna os dados do admin logado (útil para o front confirmar a sessão)
async function me(req, res) {
  res.json({ admin: req.admin });
}

// ---------- Recuperação de senha ("Esqueci minha senha") ----------

async function esqueciSenha(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Informe o e-mail.' });

    const resultado = await solicitarRecuperacao('admin', email);

    // Resposta genérica de propósito (não revela se o e-mail existe)
    res.json({
      message: 'Se este e-mail estiver cadastrado, enviamos um código de recuperação.',
      codigo_simulado: resultado.codigoSimulado,
    });
  } catch (err) {
    next(err);
  }
}

async function redefinirSenha(req, res, next) {
  try {
    const { email, codigo, nova_senha } = req.body;
    if (!email || !codigo || !nova_senha) {
      return res.status(400).json({ error: 'Preencha e-mail, código e nova senha.' });
    }
    if (nova_senha.length < 6) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
    }

    const resultado = await redefinirSenhaComCodigo('admin', email, codigo, nova_senha);

    if (!resultado.sucesso) {
      return res.status(400).json({ error: resultado.erro });
    }

    res.json({ message: 'Senha redefinida com sucesso! Você já pode entrar com a nova senha.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, me, esqueciSenha, redefinirSenha };
