// Configuração da integração com o Melhor Envio — cálculo de frete real
// (Correios, Jadlog e outras transportadoras, tudo em uma única consulta).
//
// Para ativar o frete real, o DONO DA LOJA precisa:
//   1. Criar uma conta em https://www.melhorenvio.com.br
//   2. Ir em "Gerenciar" → "Aplicações" → criar uma aplicação (ou usar o
//      token pessoal em "Gerar token" nas configurações da conta)
//   3. Copiar o token gerado
//   4. Preencher no .env do backend:
//        MELHOR_ENVIO_TOKEN=o_token_copiado_aqui
//        MELHOR_ENVIO_CEP_ORIGEM=00000000 (o CEP de onde a loja despacha,
//                                           só números, sem hífen)
//
// Enquanto o token não estiver configurado, o site roda em MODO SIMULADO:
// usa a tabela de frete fixo por região (mais simples, sem cotação real) —
// ótimo pra testar e demonstrar antes de ativar o frete de verdade.

const MELHOR_ENVIO_ATIVO = Boolean(
  process.env.MELHOR_ENVIO_TOKEN && process.env.MELHOR_ENVIO_CEP_ORIGEM
);

// Sandbox é usado automaticamente se o token começar com "sandbox_" — assim
// dá pra testar a integração de verdade sem mexer em pedidos reais.
const MELHOR_ENVIO_BASE_URL =
  process.env.MELHOR_ENVIO_TOKEN && process.env.MELHOR_ENVIO_TOKEN.startsWith('sandbox_')
    ? 'https://sandbox.melhorenvio.com.br'
    : 'https://www.melhorenvio.com.br';

module.exports = {
  MELHOR_ENVIO_ATIVO,
  MELHOR_ENVIO_BASE_URL,
  MELHOR_ENVIO_TOKEN: process.env.MELHOR_ENVIO_TOKEN,
  MELHOR_ENVIO_CEP_ORIGEM: process.env.MELHOR_ENVIO_CEP_ORIGEM,
};
