// Configuração da integração com o Melhor Envio — cálculo de frete real
// (Correios, Jadlog e outras transportadoras, tudo em uma única consulta).
//
// O Melhor Envio exige login OAuth2 (parecido com "Entrar com Google"),
// não é mais um token fixo simples. O fluxo é:
//   1. O admin clica em "Conectar com Melhor Envio" no painel.
//   2. É redirecionado pro Melhor Envio, loga e autoriza o app da loja.
//   3. O Melhor Envio manda o navegador de volta pro nosso backend com um
//      "código" — trocamos esse código por um token de acesso (válido por
//      30 dias) e um token de renovação (válido por 45 dias).
//   4. Guardamos os dois no banco de dados, e o sistema renova sozinho
//      quando o token estiver perto de vencer.
//
// Pra isso funcionar, o DONO DA LOJA precisa:
//   1. Criar uma conta em https://www.melhorenvio.com.br
//   2. Ir em "Integrações" → "Área Dev." → "Cadastrar aplicativo"
//   3. Preencher o formulário (a URL de callback deve ser
//      SEU_BACKEND/api/frete/melhor-envio/callback)
//   4. Copiar o Client ID e o Secret gerados
//   5. Preencher no .env do backend:
//        MELHOR_ENVIO_CLIENT_ID=o_client_id
//        MELHOR_ENVIO_CLIENT_SECRET=o_secret
//        MELHOR_ENVIO_CEP_ORIGEM=00000000 (CEP de onde a loja despacha)
//   6. Reiniciar o backend, entrar no painel admin, aba "Frete", e clicar
//      em "Conectar com Melhor Envio" pra autorizar de fato.
//
// Enquanto isso não for feito, o site roda em MODO SIMULADO: usa uma
// tabela de frete fixo por região — ótimo pra testar sem configurar nada.

const CLIENT_ID = (process.env.MELHOR_ENVIO_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.MELHOR_ENVIO_CLIENT_SECRET || '').trim();
const CEP_ORIGEM = (process.env.MELHOR_ENVIO_CEP_ORIGEM || '').trim();

// A aplicação foi cadastrada em ambiente de PRODUÇÃO do Melhor Envio (não
// no Sandbox), então usamos sempre o domínio de produção.
const BASE_URL = 'https://www.melhorenvio.com.br';
const AUTHORIZE_URL = `${BASE_URL}/oauth/authorize`;
const TOKEN_URL = `${BASE_URL}/oauth/token`;
const API_BASE_URL = `${BASE_URL}/api/v2`;

// Permissões pedidas ao usuário na hora de autorizar: cotação de frete,
// consulta de transportadoras, e o necessário pra futuramente comprar e
// gerar etiquetas direto pelo painel admin.
const SCOPES = [
  'shipping-calculate',
  'shipping-companies',
  'cart-read',
  'cart-write',
  'shipping-checkout',
  'shipping-generate',
  'shipping-preview',
  'shipping-print',
  'ecommerce-shipping',
].join(' ');

function obterRedirectUri() {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return null;
  return `${backendUrl}/api/frete/melhor-envio/callback`;
}

// "Configurado" = tem as credenciais necessárias pra SEQUER começar o
// processo de autorização (isso não significa que já foi autorizado).
const MELHOR_ENVIO_CONFIGURADO = Boolean(
  CLIENT_ID && CLIENT_SECRET && CEP_ORIGEM && obterRedirectUri()
);

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  CEP_ORIGEM,
  BASE_URL,
  AUTHORIZE_URL,
  TOKEN_URL,
  API_BASE_URL,
  SCOPES,
  obterRedirectUri,
  MELHOR_ENVIO_CONFIGURADO,
};
