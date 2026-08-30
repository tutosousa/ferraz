// Controla o "login" (OAuth2) do admin com o Melhor Envio: iniciar a
// autorização, receber o retorno, e consultar/encerrar a conexão.

const jwt = require('jsonwebtoken');
const {
  gerarUrlAutorizacao,
  validarState,
  trocarCodigoPorToken,
  obterStatusConexao,
  desconectar,
} = require('../services/melhorEnvioAuth');
const { MELHOR_ENVIO_CONFIGURADO } = require('../config/melhorEnvio');

function urlPainelFrete(caminho) {
  const frontendUrl = process.env.FRONTEND_URL && process.env.FRONTEND_URL !== '*'
    ? process.env.FRONTEND_URL
    : 'http://localhost:8080';
  return `${frontendUrl}/admin/frete.html${caminho}`;
}

// Etapa 1: o admin clica em "Conectar" no painel, que chama esta rota
// (passando o próprio token de admin, já que é uma navegação de página
// normal, sem como enviar cabeçalho Authorization). Confirma que quem
// está pedindo a conexão é mesmo um admin logado, e só então redireciona
// pro Melhor Envio.
async function conectar(req, res) {
  try {
    if (!MELHOR_ENVIO_CONFIGURADO) {
      return res.status(400).send(
        'O Melhor Envio ainda não foi configurado no .env do backend (faltam MELHOR_ENVIO_CLIENT_ID, MELHOR_ENVIO_CLIENT_SECRET, MELHOR_ENVIO_CEP_ORIGEM ou BACKEND_URL).'
      );
    }

    const token = req.query.admin_token;
    if (!token) return res.status(401).send('Token de admin não informado.');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.tipo !== 'admin') throw new Error('token não é de admin');
    } catch (err) {
      return res.status(401).send('Sessão de admin inválida ou expirada. Faça login de novo e tente conectar novamente.');
    }

    const urlAutorizacao = gerarUrlAutorizacao();
    res.redirect(urlAutorizacao);
  } catch (err) {
    console.error('Erro ao iniciar conexão com Melhor Envio:', err.message);
    res.status(500).send('Erro ao iniciar a conexão com o Melhor Envio.');
  }
}

// Etapa 2: o Melhor Envio manda o navegador de volta pra cá depois que o
// admin autoriza. Trocamos o código pelo token de acesso de verdade.
async function callback(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(urlPainelFrete(`?erro=${encodeURIComponent(error)}`));
  }

  if (!code || !state || !validarState(state)) {
    return res.redirect(urlPainelFrete('?erro=estado_invalido'));
  }

  try {
    await trocarCodigoPorToken(code);
    res.redirect(urlPainelFrete('?conectado=1'));
  } catch (err) {
    console.error('Erro ao trocar código por token do Melhor Envio:', err.message);
    res.redirect(urlPainelFrete('?erro=falha_conexao'));
  }
}

async function status(req, res, next) {
  try {
    const statusConexao = await obterStatusConexao();
    res.json({ configurado: MELHOR_ENVIO_CONFIGURADO, ...statusConexao });
  } catch (err) {
    next(err);
  }
}

async function desconectarConta(req, res, next) {
  try {
    await desconectar();
    res.json({ message: 'Conexão com o Melhor Envio removida.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { conectar, callback, status, desconectarConta };
