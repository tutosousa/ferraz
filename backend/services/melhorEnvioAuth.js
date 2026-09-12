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

async function gerarUrlAutorizacao(modoDiagnostico = false) {
  // No modo diagnóstico, prefixamos o "state" com "DIAG_" — isso deixa
  // marcado, só pra essa tentativa específica, que o callback deve MOSTRAR
  // o código na tela em vez de processar automaticamente. Serve pra dar
  // pro suporte do Melhor Envio um código fresco (nunca usado) pra eles
  // testarem a troca por token do lado deles.
  const state = (modoDiagnostico ? 'DIAG_' : '') + crypto.randomBytes(16).toString('hex');

  await pool.query('INSERT INTO melhor_envio_oauth_states (state) VALUES (?)', [state]);
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
// IMPORTANTE: o suporte do Melhor Envio confirmou, com um exemplo de
// chamada funcionando de verdade, que essa rota espera o corpo no formato
// "multipart/form-data" (não "application/x-www-form-urlencoded" como a
// gente vinha usando, nem JSON). Por isso usamos FormData de verdade aqui
// — e é importante NÃO definir o cabeçalho Content-Type manualmente nesse
// caso: o fetch calcula sozinho o "boundary" correto do multipart, e
// definir um Content-Type fixo aqui quebraria esse cálculo automático.
async function trocarCodigoPorToken(code) {
  const redirectUri = obterRedirectUri();

  const corpo = new FormData();
  corpo.append('grant_type', 'authorization_code');
  corpo.append('client_id', CLIENT_ID);
  corpo.append('client_secret', CLIENT_SECRET);
  corpo.append('redirect_uri', redirectUri);
  corpo.append('code', code);

  const resposta = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FERRAZ E-commerce (ferrazcollection@icloud.com)',
    },
    body: corpo,
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
// estiver perto de vencer. Mesmo formato multipart/form-data do acima.
async function renovarToken(refreshToken) {
  const corpo = new FormData();
  corpo.append('grant_type', 'refresh_token');
  corpo.append('client_id', CLIENT_ID);
  corpo.append('client_secret', CLIENT_SECRET);
  corpo.append('refresh_token', refreshToken);

  const resposta = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FERRAZ E-commerce (ferrazcollection@icloud.com)',
    },
    body: corpo,
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Falha ao renovar o token do Melhor Envio (status ${resposta.status}): ${detalhe}`);
  }

  const dados = await resposta.json();
  await salvarTokens(dados);
  return dados;
}

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
