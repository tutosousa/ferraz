// Configuração da integração com o Melhor Envio — cálculo de frete real
// (Correios, Jadlog e outras transportadoras, tudo em uma única consulta).
//
// EXISTEM DUAS FORMAS DE AUTENTICAR, E O SISTEMA ACEITA AS DUAS:
//
// FORMA 1 — Token de Acesso Direto (a mais simples, recomendada)
//   1. No painel do Melhor Envio: "Integrações" → "Permissões de acesso"
//   2. Gera um token ali (não precisa de Client ID/Secret nem de nenhum
//      processo de "Conectar")
//   3. Preenche no .env do backend:
//        MELHOR_ENVIO_ACCESS_TOKEN=o_token_gerado
//        MELHOR_ENVIO_CEP_ORIGEM=00000000 (CEP de onde a loja despacha)
//   4. Pronto — não precisa clicar em nada no painel admin, já funciona.
//
// FORMA 2 — OAuth2 (mais complexa, só como alternativa)
//   1. Cria um aplicativo em "Integrações" → "Área Dev." → "Cadastrar aplicativo"
//   2. Preenche MELHOR_ENVIO_CLIENT_ID e MELHOR_ENVIO_CLIENT_SECRET no .env
//   3. Entra no painel admin, aba "Frete", clica em "Conectar com Melhor Envio"
//
// Se as duas estiverem configuradas ao mesmo tempo, o Token de Acesso
// Direto tem prioridade (é o caminho mais simples e confiável).
//
// Enquanto nenhuma das duas estiver configurada, o site roda em MODO
// SIMULADO: frete grátis (o padrão atual da loja), sem cálculo nenhum.

// .trim() é uma proteção extra: é comum, ao copiar uma chave longa de uma
// página, vir junto um espaço ou quebra de linha invisível no início/fim
// sem a pessoa perceber — o que faz o Melhor Envio recusar a credencial
// por não bater 100% igual, mesmo "parecendo" certa visualmente.
const ACCESS_TOKEN_DIRETO = (process.env.MELHOR_ENVIO_ACCESS_TOKEN || '').trim();
const CLIENT_ID = (process.env.MELHOR_ENVIO_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.MELHOR_ENVIO_CLIENT_SECRET || '').trim();
const CEP_ORIGEM = (process.env.MELHOR_ENVIO_CEP_ORIGEM || '').trim();

// A aplicação foi cadastrada em ambiente de PRODUÇÃO do Melhor Envio (não
// no Sandbox), então usamos sempre o domínio de produção.
// IMPORTANTE: o domínio correto é "melhorenvio.com.br" — SEM "www." na
// frente. O próprio suporte do Melhor Envio confirmou isso (mandaram um
// link de exemplo funcionando exatamente sem o www.), e é bem provável
// que o sistema deles trate os dois domínios como coisas diferentes,
// causando a falha de autenticação mesmo com tudo mais certo.
const BASE_URL = 'https://melhorenvio.com.br';
const AUTHORIZE_URL = `${BASE_URL}/oauth/authorize`;
const TOKEN_URL = `${BASE_URL}/oauth/token`;
const API_BASE_URL = `${BASE_URL}/api/v2`;

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
  const backendUrl = (process.env.BACKEND_URL || '').trim();
  if (!backendUrl) return null;
  // Remove barra(s) no final do BACKEND_URL, se houver — sem isso, um
  // BACKEND_URL salvo como "https://site.com/" (com barra) geraria um
  // endereço de callback com barra DUPLA ("...com//api/..."), que não bate
  // com o que está cadastrado no Melhor Envio, causando falha silenciosa.
  const backendUrlLimpo = backendUrl.replace(/\/+$/, '');
  return `${backendUrlLimpo}/api/frete/melhor-envio/callback`;
}

// Configurado se: (token direto + CEP) OU (as credenciais OAuth completas).
const MELHOR_ENVIO_CONFIGURADO = Boolean(
  (ACCESS_TOKEN_DIRETO && CEP_ORIGEM) ||
  (CLIENT_ID && CLIENT_SECRET && CEP_ORIGEM && obterRedirectUri())
);

module.exports = {
  ACCESS_TOKEN_DIRETO,
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
