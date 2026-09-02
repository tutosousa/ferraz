// Contas de clientes da loja: cadastro com confirmação por e-mail, login
// em duas etapas (2FA), perfil/endereço e histórico de pedidos.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { enviarEmailCodigo } = require('../config/email');
const { solicitarRecuperacao, redefinirSenhaComCodigo } = require('../services/passwordReset');

const MINUTOS_EXPIRACAO_CODIGO = 10;

function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

function gerarToken(cliente) {
  return jwt.sign(
    { id: cliente.id, email: cliente.email, nome: cliente.nome, tipo: 'cliente' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

async function criarESalvarCodigo(clienteId, tipo) {
  const codigo = gerarCodigo();
  const expiraEm = new Date(Date.now() + MINUTOS_EXPIRACAO_CODIGO * 60 * 1000);

  // Invalida códigos anteriores do mesmo tipo ainda não usados, pra evitar
  // confusão de qual código é o válido caso a pessoa peça mais de um.
  await pool.query(
    'UPDATE codigos_verificacao SET usado = 1 WHERE cliente_id = ? AND tipo = ? AND usado = 0',
    [clienteId, tipo]
  );

  await pool.query(
    'INSERT INTO codigos_verificacao (cliente_id, codigo, tipo, expira_em) VALUES (?, ?, ?, ?)',
    [clienteId, codigo, tipo, expiraEm]
  );

  return codigo;
}

async function validarCodigo(clienteId, codigo, tipo) {
  const [rows] = await pool.query(
    `SELECT id FROM codigos_verificacao
     WHERE cliente_id = ? AND codigo = ? AND tipo = ? AND usado = 0 AND expira_em > NOW()
     ORDER BY id DESC LIMIT 1`,
    [clienteId, codigo, tipo]
  );
  if (rows.length === 0) return false;

  await pool.query('UPDATE codigos_verificacao SET usado = 1 WHERE id = ?', [rows[0].id]);
  return true;
}

// ---------- CADASTRO (com confirmação por e-mail) ----------

async function cadastrar(req, res, next) {
  try {
    const { nome, email, senha, confirmar_senha, telefone } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
    }
    if (confirmar_senha !== undefined && senha !== confirmar_senha) {
      return res.status(400).json({ error: 'As senhas não coincidem.' });
    }

    const [emailExistente] = await pool.query('SELECT id FROM clientes WHERE email = ?', [email]);
    if (emailExistente.length > 0) {
      return res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
    }

    if (telefone) {
      const [telefoneExistente] = await pool.query(
        'SELECT id FROM clientes WHERE telefone = ?',
        [telefone]
      );
      if (telefoneExistente.length > 0) {
        return res.status(409).json({ error: 'Este número de telefone já está cadastrado em outra conta.' });
      }
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const [resultado] = await pool.query(
      'INSERT INTO clientes (nome, email, senha_hash, telefone, email_verificado) VALUES (?, ?, ?, ?, 0)',
      [nome, email, senhaHash, telefone || null]
    );

    const clienteId = resultado.insertId;
    const codigo = await criarESalvarCodigo(clienteId, 'cadastro');
    const envio = await enviarEmailCodigo(email, codigo, 'cadastro');

    res.status(201).json({
      message: 'Conta criada! Verifique o código enviado para o seu e-mail.',
      cliente_id: clienteId,
      // Em modo simulado (sem SMTP configurado), o código vem na resposta
      // só para permitir testar localmente sem precisar de e-mail de verdade.
      codigo_simulado: envio.simulado ? codigo : undefined,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'E-mail ou telefone já cadastrado em outra conta.' });
    }
    next(err);
  }
}

async function verificarCadastro(req, res, next) {
  try {
    const { cliente_id, codigo } = req.body;
    if (!cliente_id || !codigo) {
      return res.status(400).json({ error: 'Informe o código recebido por e-mail.' });
    }

    const valido = await validarCodigo(cliente_id, codigo, 'cadastro');
    if (!valido) {
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }

    await pool.query('UPDATE clientes SET email_verificado = 1 WHERE id = ?', [cliente_id]);

    res.json({ message: 'E-mail confirmado com sucesso! Você já pode entrar na sua conta.' });
  } catch (err) {
    next(err);
  }
}

async function reenviarCodigoCadastro(req, res, next) {
  try {
    const { cliente_id } = req.body;
    const [rows] = await pool.query('SELECT email, email_verificado FROM clientes WHERE id = ?', [
      cliente_id,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
    if (rows[0].email_verificado) {
      return res.status(400).json({ error: 'Este e-mail já foi confirmado.' });
    }

    const codigo = await criarESalvarCodigo(cliente_id, 'cadastro');
    const envio = await enviarEmailCodigo(rows[0].email, codigo, 'cadastro');

    res.json({ message: 'Novo código enviado.', codigo_simulado: envio.simulado ? codigo : undefined });
  } catch (err) {
    next(err);
  }
}

// ---------- LOGIN EM DUAS ETAPAS ----------

// Etapa 1: confere e-mail + senha. Se corretos, envia um código de acesso
// por e-mail em vez de já devolver o token de login.
async function login(req, res, next) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const [rows] = await pool.query(
      'SELECT id, nome, email, senha_hash, email_verificado FROM clientes WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const cliente = rows[0];
    const senhaCorreta = await bcrypt.compare(senha, cliente.senha_hash);

    if (!senhaCorreta) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    if (!cliente.email_verificado) {
      return res.status(403).json({
        error: 'Confirme seu e-mail antes de entrar.',
        precisa_confirmar_cadastro: true,
        cliente_id: cliente.id,
      });
    }

    const codigo = await criarESalvarCodigo(cliente.id, 'login');
    const envio = await enviarEmailCodigo(cliente.email, codigo, 'login');

    res.json({
      message: 'Digite o código de acesso enviado para o seu e-mail.',
      precisa_verificar: true,
      cliente_id: cliente.id,
      codigo_simulado: envio.simulado ? codigo : undefined,
    });
  } catch (err) {
    next(err);
  }
}

// Etapa 2: confere o código de acesso e só aí devolve o token de sessão.
async function verificarLogin(req, res, next) {
  try {
    const { cliente_id, codigo } = req.body;
    if (!cliente_id || !codigo) {
      return res.status(400).json({ error: 'Informe o código de acesso.' });
    }

    const valido = await validarCodigo(cliente_id, codigo, 'login');
    if (!valido) {
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }

    const [rows] = await pool.query('SELECT id, nome, email FROM clientes WHERE id = ?', [
      cliente_id,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada.' });

    const token = gerarToken(rows[0]);
    res.json({ token, cliente: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function reenviarCodigoLogin(req, res, next) {
  try {
    const { cliente_id } = req.body;
    const [rows] = await pool.query('SELECT email FROM clientes WHERE id = ?', [cliente_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada.' });

    const codigo = await criarESalvarCodigo(cliente_id, 'login');
    const envio = await enviarEmailCodigo(rows[0].email, codigo, 'login');

    res.json({ message: 'Novo código enviado.', codigo_simulado: envio.simulado ? codigo : undefined });
  } catch (err) {
    next(err);
  }
}

// ---------- PERFIL / PEDIDOS (rotas protegidas) ----------

async function meuPerfil(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, nome, email, telefone, endereco_rua, endereco_numero, endereco_bairro,
              endereco_cidade, endereco_estado, endereco_cep
       FROM clientes WHERE id = ?`,
      [req.cliente.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Conta não encontrada.' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function atualizarPerfil(req, res, next) {
  try {
    const {
      nome,
      telefone,
      endereco_rua,
      endereco_numero,
      endereco_bairro,
      endereco_cidade,
      endereco_estado,
      endereco_cep,
    } = req.body;

    if (telefone) {
      const [existente] = await pool.query(
        'SELECT id FROM clientes WHERE telefone = ? AND id != ?',
        [telefone, req.cliente.id]
      );
      if (existente.length > 0) {
        return res.status(409).json({ error: 'Este número de telefone já está em uso em outra conta.' });
      }
    }

    await pool.query(
      `UPDATE clientes SET
        nome = COALESCE(?, nome),
        telefone = ?,
        endereco_rua = ?,
        endereco_numero = ?,
        endereco_bairro = ?,
        endereco_cidade = ?,
        endereco_estado = ?,
        endereco_cep = ?
       WHERE id = ?`,
      [
        nome,
        telefone || null,
        endereco_rua || null,
        endereco_numero || null,
        endereco_bairro || null,
        endereco_cidade || null,
        endereco_estado || null,
        endereco_cep || null,
        req.cliente.id,
      ]
    );

    res.json({ message: 'Dados atualizados com sucesso.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Este telefone já está em uso em outra conta.' });
    }
    next(err);
  }
}

async function meusPedidos(req, res, next) {
  try {
    // Pedidos cancelados pelo admin não aparecem mais aqui — o filtro é
    // feito direto na consulta ao banco, então some de verdade (não é só
    // escondido na tela; recarregar a página ou entrar de novo na conta
    // não traz ele de volta).
    const [pedidos] = await pool.query(
      "SELECT * FROM pedidos WHERE cliente_id = ? AND status != 'cancelado' ORDER BY criado_em DESC",
      [req.cliente.id]
    );
    res.json(pedidos);
  } catch (err) {
    next(err);
  }
}

// ---------- Recuperação de senha ("Esqueci minha senha") ----------

async function esqueciSenha(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Informe o e-mail.' });

    const resultado = await solicitarRecuperacao('cliente', email);

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

    const resultado = await redefinirSenhaComCodigo('cliente', email, codigo, nova_senha);

    if (!resultado.sucesso) {
      return res.status(400).json({ error: resultado.erro });
    }

    res.json({ message: 'Senha redefinida com sucesso! Você já pode entrar com a nova senha.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};
