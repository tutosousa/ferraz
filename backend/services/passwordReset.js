// Serviço compartilhado de recuperação de senha ("Esqueci minha senha"),
// usado tanto pelo painel administrativo quanto pelas contas de cliente.
//
// Por segurança, as respostas SEMPRE são genéricas — nunca confirmam se um
// e-mail existe ou não no sistema (isso evita que alguém use essa tela pra
// descobrir quais e-mails têm conta cadastrada, um ataque conhecido como
// "enumeração de contas").

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { enviarEmailCodigo, EMAIL_ATIVO } = require('../config/email');

const MINUTOS_EXPIRACAO_CODIGO = 10;

function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const TABELAS = {
  admin: { nome: 'admins', temSenhaHash: 'senha_hash' },
  cliente: { nome: 'clientes', temSenhaHash: 'senha_hash' },
};

// Etapa 1: recebe o e-mail, e SE existir uma conta com esse e-mail, envia
// um código de recuperação. Responde a mesma mensagem em qualquer caso.
async function solicitarRecuperacao(tipo, email) {
  const tabela = TABELAS[tipo];
  const [rows] = await pool.query(`SELECT id, email FROM ${tabela.nome} WHERE email = ?`, [
    email,
  ]);

  if (rows.length > 0) {
    const usuario = rows[0];
    const codigo = gerarCodigo();
    const expiraEm = new Date(Date.now() + MINUTOS_EXPIRACAO_CODIGO * 60 * 1000);

    // Invalida códigos de recuperação anteriores ainda não usados
    await pool.query(
      'UPDATE codigos_recuperacao_senha SET usado = 1 WHERE tipo = ? AND usuario_id = ? AND usado = 0',
      [tipo, usuario.id]
    );

    await pool.query(
      'INSERT INTO codigos_recuperacao_senha (tipo, usuario_id, codigo, expira_em) VALUES (?, ?, ?, ?)',
      [tipo, usuario.id, codigo, expiraEm]
    );

    const envio = await enviarEmailCodigoRecuperacao(usuario.email, codigo);
    return { encontrado: true, codigoSimulado: envio.simulado ? codigo : undefined };
  }

  // E-mail não encontrado: não envia nada, mas a resposta pro chamador é
  // idêntica à do caminho de sucesso (ver controllers).
  return { encontrado: false };
}

async function enviarEmailCodigoRecuperacao(email, codigo) {
  // Reaproveita o mesmo mecanismo de envio (modo real ou simulado) usado
  // nos códigos de cadastro/login, só com um texto diferente.
  if (!EMAIL_ATIVO) {
    console.log(`\n📧 [MODO SIMULADO] E-mail de recuperação de senha para ${email}`);
    console.log(`   Código: ${codigo}\n`);
    return { simulado: true };
  }
  await enviarEmailCodigo(email, codigo, 'login'); // reaproveita o texto genérico de "código de acesso"
  return { simulado: false };
}

// Etapa 2: confere o código e, se válido, troca a senha.
async function redefinirSenhaComCodigo(tipo, email, codigo, novaSenha) {
  const tabela = TABELAS[tipo];

  const [usuarios] = await pool.query(`SELECT id FROM ${tabela.nome} WHERE email = ?`, [email]);
  if (usuarios.length === 0) {
    return { sucesso: false, erro: 'Código inválido ou expirado.' };
  }
  const usuarioId = usuarios[0].id;

  const [codigos] = await pool.query(
    `SELECT id FROM codigos_recuperacao_senha
     WHERE tipo = ? AND usuario_id = ? AND codigo = ? AND usado = 0 AND expira_em > NOW()
     ORDER BY id DESC LIMIT 1`,
    [tipo, usuarioId, codigo]
  );

  if (codigos.length === 0) {
    return { sucesso: false, erro: 'Código inválido ou expirado.' };
  }

  await pool.query('UPDATE codigos_recuperacao_senha SET usado = 1 WHERE id = ?', [codigos[0].id]);

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  await pool.query(`UPDATE ${tabela.nome} SET senha_hash = ? WHERE id = ?`, [senhaHash, usuarioId]);

  return { sucesso: true };
}

module.exports = { solicitarRecuperacao, redefinirSenhaComCodigo };
