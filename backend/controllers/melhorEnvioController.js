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

    const modoDiagnostico = req.query.diagnostico === '1';
    const urlAutorizacao = await gerarUrlAutorizacao(modoDiagnostico);
    res.redirect(urlAutorizacao);
  } catch (err) {
    console.error('Erro ao iniciar conexão com Melhor Envio:', err.message);
    res.status(500).send('Erro ao iniciar a conexão com o Melhor Envio.');
  }
}

async function callback(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    console.error(`Melhor Envio retornou erro direto no callback: ${error}`);
    return res.redirect(urlPainelFrete(`?erro=${encodeURIComponent(error)}`));
  }

  const stateValido = state && (await validarState(state));
  const ehDiagnostico = Boolean(state) && state.startsWith('DIAG_');
  if (!code || !stateValido) {
<<<<<<< HEAD
    // Diagnóstico: mostra exatamente qual das duas partes falhou, sem
    // expor o "code"/"state" inteiros no log (só um pedacinho, o
    // suficiente pra conferir sem virar um segredo exposto).
=======
>>>>>>> d7f2e395ac06c5a404a5975544b587b9ee7d5afa
    console.error(
      `Callback do Melhor Envio com estado inválido — code presente: ${Boolean(code)}, ` +
      `state presente: ${Boolean(state)}, state válido no banco: ${stateValido}, ` +
      `state recebido (preview): ${state ? state.slice(0, 8) + '...' : 'nenhum'}`
    );
    return res.redirect(urlPainelFrete('?erro=estado_invalido'));
  }

  if (ehDiagnostico) {
    const { obterRedirectUri } = require('../config/melhorEnvio');
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head><meta charset="UTF-8"><title>Código de diagnóstico</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 60px auto; padding: 20px;">
        <h2>🔧 Modo diagnóstico — código capturado</h2>
        <p><strong>⚠️ Esse código é de uso único e expira em poucos minutos — copie e use rápido.</strong></p>
        <p><strong>code:</strong></p>
        <textarea readonly style="width:100%; height:60px; font-family:monospace; padding:8px;">${code}</textarea>
        <p><strong>redirect_uri usado nesta chamada:</strong></p>
        <textarea readonly style="width:100%; height:40px; font-family:monospace; padding:8px;">${obterRedirectUri()}</textarea>
        <p style="color:#666; font-size:0.9rem;">Esta tela é temporária, só pra diagnóstico — a conexão de verdade com o Melhor Envio NÃO foi feita ainda com esse código.</p>
      </body>
      </html>
    `);
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
