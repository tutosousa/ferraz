// Configuração do cliente do Mercado Pago (Checkout Pro).
//
// Para ativar pagamentos de verdade, o DONO DA LOJA precisa:
//   1. Criar uma conta em https://www.mercadopago.com.br
//   2. Acessar https://www.mercadopago.com.br/developers/panel
//   3. Criar uma aplicação e copiar o "Access Token de produção"
//   4. Colar esse token na variável MP_ACCESS_TOKEN do .env do backend
//
// Enquanto MP_ACCESS_TOKEN não estiver configurado, o sistema funciona em
// "modo simulado": os pedidos são aprovados automaticamente, sem cobrança
// real — ótimo para testar e demonstrar o site antes de ativar o gateway.

const { MercadoPagoConfig } = require('mercadopago');

const MP_ATIVO = Boolean(process.env.MP_ACCESS_TOKEN);
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY || null;

const mpClient = MP_ATIVO
  ? new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
      options: { timeout: 8000 },
    })
  : null;

module.exports = { mpClient, MP_ATIVO, MP_PUBLIC_KEY };
