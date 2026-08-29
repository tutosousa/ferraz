// Integração de pagamento com o Mercado Pago — CHECKOUT INVISÍVEL.
//
// O cliente nunca sai do site da FERRAZ: o formulário de pagamento (cartão,
// Pix ou boleto) é o próprio "Payment Brick" do Mercado Pago, embutido na
// página de checkout. O fluxo é:
//   1. O front pede a Public Key em GET /api/pagamentos/config.
//   2. O Brick é renderizado dentro do checkout.html com essa chave.
//   3. Quando o cliente confirma o pagamento, o Brick nos entrega um
//      "formData" (dados tokenizados, sem o número do cartão em texto puro).
//   4. Nosso backend recebe esse formData em POST /api/pagamentos/processar,
//      RECALCULA o valor a partir do pedido salvo no banco (nunca confia no
//      valor vindo do navegador) e chama a API de Pagamentos do Mercado Pago.
//   5. Respondemos na hora se foi aprovado, recusado ou está em análise —
//      tudo sem sair da página.
//
// Modo simulado (sem MP_ACCESS_TOKEN configurado): o pedido já é aprovado
// automaticamente no momento da criação (ver orderController.js), então o
// checkout nem chega a mostrar o formulário de pagamento — ótimo pra testar
// e demonstrar o site antes de o dono da loja ativar a conta do Mercado Pago.

const { Preference, Payment } = require('mercadopago');
const { mpClient, MP_ATIVO, MP_PUBLIC_KEY } = require('../config/mercadopago');
const { pool } = require('../config/db');

// Devolve pro frontend a chave pública e se o gateway está ativo — isso
// não é segredo, a Public Key é feita pra ser usada no navegador.
async function getConfig(req, res) {
  res.json({ ativo: MP_ATIVO, publicKey: MP_PUBLIC_KEY });
}

// Processa o pagamento vindo do Payment Brick (checkout invisível).
async function processarPagamento(req, res, next) {
  try {
    if (!MP_ATIVO) {
      return res.status(400).json({ error: 'Gateway de pagamento não configurado.' });
    }

    const { numero_pedido, formData } = req.body;
    if (!numero_pedido || !formData) {
      return res.status(400).json({ error: 'Dados de pagamento incompletos.' });
    }

    const [pedidos] = await pool.query('SELECT * FROM pedidos WHERE numero_pedido = ?', [
      numero_pedido,
    ]);
    if (pedidos.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    const pedido = pedidos[0];

    if (pedido.status !== 'pendente') {
      return res.status(400).json({ error: 'Este pedido já foi processado.' });
    }

    const payment = new Payment(mpClient);

    // O valor SEMPRE vem do banco (pedido salvo no passo anterior), nunca
    // do formData do navegador — evita que alguém manipule o preço no front.
    const corpoPagamento = {
      transaction_amount: Number(pedido.total),
      description: `Pedido FERRAZ ${pedido.numero_pedido}`,
      external_reference: pedido.numero_pedido,
      payment_method_id: formData.payment_method_id,
      payer: formData.payer,
      notification_url: process.env.BACKEND_URL
        ? `${process.env.BACKEND_URL}/api/pagamentos/webhook`
        : undefined,
    };

    // Campos específicos de cartão (só existem quando o meio de pagamento é cartão)
    if (formData.token) corpoPagamento.token = formData.token;
    if (formData.installments) corpoPagamento.installments = formData.installments;
    if (formData.issuer_id) corpoPagamento.issuer_id = formData.issuer_id;

    const resultado = await payment.create({
      body: corpoPagamento,
      requestOptions: { idempotencyKey: `${pedido.numero_pedido}-${Date.now()}` },
    });

    let novoStatus = 'pendente';
    if (resultado.status === 'approved') novoStatus = 'pago';
    else if (resultado.status === 'rejected') novoStatus = 'cancelado';

    await pool.query('UPDATE pedidos SET status = ?, mp_payment_id = ? WHERE id = ?', [
      novoStatus,
      String(resultado.id),
      pedido.id,
    ]);

    res.json({
      status: resultado.status, // approved | in_process | pending | rejected
      status_detail: resultado.status_detail,
      payment_id: resultado.id,
      // Para Pix: o QR code vem aqui, pro front exibir sem sair da página
      qr_code: resultado.point_of_interaction?.transaction_data?.qr_code || null,
      qr_code_base64: resultado.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      // Para boleto: o link do PDF do boleto
      ticket_url: resultado.transaction_details?.external_resource_url || null,
    });
  } catch (err) {
    console.error('Erro ao processar pagamento:', err.message);
    next(
      Object.assign(new Error('Não foi possível processar o pagamento. Verifique os dados e tente novamente.'), {
        status: 502,
        expose: true,
      })
    );
  }
}

// ---------- Mantido como alternativa: Checkout Pro (redireciona pro MP) ----------
// Não é mais usado no fluxo padrão (que agora é o checkout invisível acima),
// mas fica disponível caso um dia vocês queiram voltar a usar o checkout
// hospedado pelo próprio Mercado Pago.
async function criarPreferenciaPagamento(pedido, itens) {
  const preference = new Preference(mpClient);

  const frontendUrl = process.env.FRONTEND_URL && process.env.FRONTEND_URL !== '*'
    ? process.env.FRONTEND_URL
    : 'http://localhost:8080';
  const ehUrlLocal = /localhost|127\.0\.0\.1/.test(frontendUrl);

  const items = itens.map((item) => ({
    title: item.nome_produto,
    quantity: item.quantidade,
    unit_price: Number(item.preco_unitario),
    currency_id: 'BRL',
  }));

  if (pedido.frete > 0) {
    items.push({ title: 'Frete', quantity: 1, unit_price: Number(pedido.frete), currency_id: 'BRL' });
  }

  const resultado = await preference.create({
    body: {
      items,
      external_reference: pedido.numero_pedido,
      payer: { name: pedido.cliente_nome, email: pedido.cliente_email || undefined },
      back_urls: {
        success: `${frontendUrl}/pedido-sucesso.html?numero=${pedido.numero_pedido}`,
        pending: `${frontendUrl}/pedido-sucesso.html?numero=${pedido.numero_pedido}`,
        failure: `${frontendUrl}/checkout.html?erro=pagamento`,
      },
      ...(ehUrlLocal ? {} : { auto_return: 'approved' }),
      notification_url: process.env.BACKEND_URL
        ? `${process.env.BACKEND_URL}/api/pagamentos/webhook`
        : undefined,
    },
  });

  return { init_point: resultado.init_point, preference_id: resultado.id };
}

// Webhook chamado pelo Mercado Pago quando o status de um pagamento muda
// (confirmação assíncrona, importante sobretudo para Pix e boleto, que
// demoram para compensar).
async function receberWebhook(req, res) {
  try {
    const paymentId = req.query['data.id'] || req.body?.data?.id;
    const topic = req.query.type || req.body?.type;

    if (topic !== 'payment' || !paymentId) {
      return res.sendStatus(200);
    }

    const payment = new Payment(mpClient);
    const pagamento = await payment.get({ id: paymentId });

    const numeroPedido = pagamento.external_reference;
    if (!numeroPedido) return res.sendStatus(200);

    let novoStatus = null;
    if (pagamento.status === 'approved') novoStatus = 'pago';
    else if (pagamento.status === 'rejected') novoStatus = 'cancelado';

    if (novoStatus) {
      await pool.query(
        'UPDATE pedidos SET status = ?, mp_payment_id = ? WHERE numero_pedido = ?',
        [novoStatus, String(paymentId), numeroPedido]
      );
    } else {
      await pool.query('UPDATE pedidos SET mp_payment_id = ? WHERE numero_pedido = ?', [
        String(paymentId),
        numeroPedido,
      ]);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Erro ao processar webhook do Mercado Pago:', err.message);
    res.sendStatus(200);
  }
}

module.exports = {
  getConfig,
  processarPagamento,
  criarPreferenciaPagamento,
  receberWebhook,
  MP_ATIVO,
};
