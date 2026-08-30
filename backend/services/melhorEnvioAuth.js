// Gerencia o "login" (OAuth2) com o Melhor Envio: gera a URL de
// autorização, troca o código pelo token, guarda no banco, e renova
// sozinho quando o token estiver perto de vencer — assim o resto do
// sistema nunca precisa se preocupar com isso, só chama obterTokenValido().

const crypto = require('crypto');
const { pool } = require('../config/db');
const {
  CLIENT_ID,
  CLIENT_SECRET,
  AUTHORIZE_URL,
  TOKEN_URL,
  SCOPES,
  obterRedirectUri,
} = require('../config/melhorEnvio');

// Guarda os "state" (proteção contra CSRF) gerados ao iniciar a
// autorização, NO BANCO DE DADOS — não em memória — pra sobreviver caso o
// servidor reinicie ou "durma" (comum em planos gratuitos como o Render)
// entre o clique em "Conectar" e a volta autorizada do Melhor Envio.

async function gerarUrlAutorizacao() {
  const state = crypto.randomBytes(16).toString('hex');

  await pool.query('INSERT INTO melhor_envio_oauth_states (state) VALUES (?)', [state]);
  // Limpa states velhos (mais de 30 minutos), pra não acumular lixo
  await pool.query(
    'DELETE FROM melhor_envio_oauth_states WHERE criado_em < NOW() - INTERVAL 30 MINUTE'
  );

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: obterRedirectUri(),
    response_type: 'code',
    state,
    scope: SCOPES,
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function validarState(state) {
  const [rows] = await pool.query(
    'SELECT state FROM melhor_envio_oauth_states WHERE state = ?',
    [state]
  );
  if (rows.length === 0) return false;
  await pool.query('DELETE FROM melhor_envio_oauth_states WHERE state = ?', [state]);
  return true;
}

async function salvarTokens(dados) {
  const expiraEm = new Date(Date.now() + dados.expires_in * 1000);

  await pool.query('DELETE FROM melhor_envio_conexao');
  await pool.query(
    'INSERT INTO melhor_envio_conexao (access_token, refresh_token, expira_em) VALUES (?, ?, ?)',
    [dados.access_token, dados.refresh_token, expiraEm]
  );
}

// Troca o "código" recebido no callback por um token de acesso de verdade.
//
// IMPORTANTE: diferente do resto da API do Melhor Envio (que usa JSON), as
// rotas de autenticação OAuth2 (/oauth/token) esperam o corpo no formato
// tradicional de formulário (application/x-www-form-urlencoded), não JSON
// — a própria documentação deles avisa essa exceção.
async function trocarCodigoPorToken(code) {
  const redirectUri = obterRedirectUri();

  // Log de diagnóstico: mostra exatamente o que está sendo enviado (nunca
  // o Secret completo, só os primeiros e últimos caracteres, o suficiente
  // pra conferir sem expor a chave inteira no log).
  console.log(
    `📤 Enviando ao Melhor Envio: client_id="${CLIENT_ID}", ` +
    `secret="${CLIENT_SECRET.slice(0, 4)}...${CLIENT_SECRET.slice(-4)}" (${CLIENT_SECRET.length} chars), ` +
    `redirect_uri="${redirectUri}"`
  );

  const corpo = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
    code,
  });

  // Além de mandar client_id/client_secret no corpo (jeito mais comum),
  // também mandamos no cabeçalho "Authorization: Basic" — alguns
  // servidores OAuth2 exigem especificamente esse método pra autenticar o
  // aplicativo, mesmo com os dados certos no corpo.
  const credenciaisBasic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const resposta = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credenciaisBasic}`,
      'User-Agent': 'FERRAZ E-commerce (ferrazcollection@icloud.com)',
    },
    body: corpo.toString(),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Melhor Envio recusou o código de autorização (status ${resposta.status}): ${detalhe}`);
  }

  const dados = await resposta.json();
  await salvarTokens(dados);
  return dados;
}

// Pede um token novo usando o refresh_token guardado, quando o atual
// estiver perto de vencer. Mesma observação sobre form-urlencoded acima.
async function renovarToken(refreshToken) {
  const corpo = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const resposta = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'FERRAZ E-commerce (ferrazcollection@icloud.com)',
    },
    body: corpo.toString(),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Falha ao renovar o token do Melhor Envio (status ${resposta.status}): ${detalhe}`);
  }

  const dados = await resposta.json();
  await salvarTokens(dados);
  return dados;
}

// Retorna um access_token válido pronto pra usar — renova sozinho se
// estiver a menos de 2 dias de vencer. Retorna null se a loja ainda não
// tiver conectado o Melhor Envio nenhuma vez.
async function obterTokenValido() {
  const [rows] = await pool.query(
    'SELECT access_token, refresh_token, expira_em FROM melhor_envio_conexao ORDER BY id DESC LIMIT 1'
  );

  if (rows.length === 0) return null;

  const conexao = rows[0];
  const margemSeguranca = 2 * 24 * 60 * 60 * 1000; // renova 2 dias antes de vencer
  const jaVenceOuVaiVencerLogo = new Date(conexao.expira_em).getTime() - Date.now() < margemSeguranca;

  if (jaVenceOuVaiVencerLogo) {
    const novosDados = await renovarToken(conexao.refresh_token);
    return novosDados.access_token;
  }

  return conexao.access_token;
}

async function obterStatusConexao() {
  const [rows] = await pool.query(
    'SELECT expira_em, atualizado_em FROM melhor_envio_conexao ORDER BY id DESC LIMIT 1'
  );
  if (rows.length === 0) {
    return { conectado: false };
  }
  return {
    conectado: true,
    expira_em: rows[0].expira_em,
    conectado_em: rows[0].atualizado_em,
  };
}

async function desconectar() {
  await pool.query('DELETE FROM melhor_envio_conexao');
}

module.exports = {
  gerarUrlAutorizacao,
  validarState,
  trocarCodigoPorToken,
  obterTokenValido,
  obterStatusConexao,
  desconectar,
};
