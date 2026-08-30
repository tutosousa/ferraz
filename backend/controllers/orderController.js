const { pool } = require('../config/db');
const { MP_ATIVO } = require('./paymentController');

// Frete grátis para todos os pedidos (varejo e atacado) — não há mais
// cálculo nenhum, o total é sempre igual ao subtotal dos produtos.

function gerarNumeroPedido() {
  const timestamp = Date.now().toString().slice(-8);
  const aleatorio = Math.floor(100 + Math.random() * 900);
  return `FRZ-${timestamp}${aleatorio}`;
}

const QUANTIDADE_MINIMA_PEDIDO_ATACADO = 12;

// Cria um pedido (checkout).
//
// - Se MP_ACCESS_TOKEN estiver configurado: cria o pedido como "pendente" e
//   uma preferência de pagamento no Mercado Pago, devolvendo a URL de
//   pagamento (init_point) para o front redirecionar o comprador.
// - Se não estiver configurado (modo simulado/demonstração): aprova o
//   pedido na hora, sem cobrança real, só pra poder testar o fluxo completo.
async function createOrder(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const {
      cliente_telefone,
      endereco_rua,
      endereco_numero,
      endereco_bairro,
      endereco_cidade,
      endereco_estado,
      endereco_cep,
      forma_pagamento,
      tipo_pedido, // 'varejo' (padrão) ou 'atacado'
      itens, // [{ produto_id, quantidade }]
    } = req.body;

    // O checkout agora exige login — nome e e-mail vêm da CONTA autenticada
    // (não do formulário), pra ninguém conseguir forjar em nome de outra
    // pessoa. O telefone de contato continua vindo do formulário, já que
    // pode ser diferente do telefone cadastrado na conta.
    const cliente_nome = req.cliente.nome;
    const cliente_email = req.cliente.email;

    const tipoPedido = tipo_pedido === 'atacado' ? 'atacado' : 'varejo';

    if (!cliente_nome || !cliente_telefone || !endereco_estado || !itens || itens.length === 0) {
      return res.status(400).json({ error: 'Dados do pedido incompletos.' });
    }

    // No pedido de atacado, a quantidade TOTAL do carrinho (somando todos
    // os produtos) precisa atingir o mínimo de 12 peças.
    if (tipoPedido === 'atacado') {
      const totalPecas = itens.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0);
      if (totalPecas < QUANTIDADE_MINIMA_PEDIDO_ATACADO) {
        return res.status(400).json({
          error: `O pedido mínimo no atacado é de ${QUANTIDADE_MINIMA_PEDIDO_ATACADO} peças (você tem ${totalPecas}).`,
        });
      }
    }

    await connection.beginTransaction();

    // Busca preços reais no banco (nunca confia no preço enviado pelo front)
    let subtotal = 0;
    const itensProcessados = [];

    for (const item of itens) {
      const [produtoRows] = await connection.query(
        'SELECT id, nome, preco_varejo, preco_atacado, preco_custo, desconto_atacado_percentual, quantidade_minima_atacado, estoque, peso_kg, altura_cm, largura_cm, comprimento_cm FROM produtos WHERE id = ? AND ativo = 1 FOR UPDATE',
        [item.produto_id]
      );

      if (produtoRows.length === 0) {
        throw Object.assign(new Error(`Produto ${item.produto_id} não encontrado ou indisponível.`), {
          status: 400,
          expose: true,
        });
      }

      const produto = produtoRows[0];
      const quantidade = Number(item.quantidade) || 0;

      if (quantidade <= 0) continue;

      if (produto.estoque < quantidade) {
        throw Object.assign(
          new Error(`Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoque}.`),
          { status: 400, expose: true }
        );
      }

      // No pedido de atacado, TODOS os itens usam o preço de atacado do
      // produto direto (a página de atacado já vende nesse preço, sem
      // precisar bater 50 unidades DAQUELE produto individualmente).
      // No pedido de varejo, o preço de atacado só é aplicado se a
      // quantidade daquele item específico atingir o mínimo do produto.
      const isAtacado =
        tipoPedido === 'atacado'
          ? Boolean(produto.preco_atacado)
          : quantidade >= (produto.quantidade_minima_atacado || 50);

      const precoUnitario = isAtacado && produto.preco_atacado
        ? produto.preco_atacado
        : produto.preco_varejo;

      const itemSubtotal = precoUnitario * quantidade;
      subtotal += itemSubtotal;

      itensProcessados.push({
        produto_id: produto.id,
        nome_produto: produto.nome,
        tamanho: item.tamanho || null,
        cor: item.cor || null,
        quantidade,
        preco_unitario: precoUnitario,
        preco_custo_unitario: produto.preco_custo,
        subtotal: itemSubtotal,
        tipo_preco: isAtacado ? 'atacado' : 'varejo',
        peso_kg: produto.peso_kg,
        altura_cm: produto.altura_cm,
        largura_cm: produto.largura_cm,
        comprimento_cm: produto.comprimento_cm,
      });

      // Baixa de estoque
      await connection.query('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [
        quantidade,
        produto.id,
      ]);
    }

    if (itensProcessados.length === 0) {
      throw Object.assign(new Error('O carrinho está vazio.'), { status: 400, expose: true });
    }

    // Frete grátis pra todo mundo — não tem cálculo, não tem consulta,
    // sempre R$ 0.
    const frete = 0;
    const total = subtotal + frete;
    const numeroPedido = gerarNumeroPedido();

    // Se a compra foi feita por um cliente logado (token opcional verificado
    // pelo middleware attachCustomerIfPresent), vincula o pedido à conta dele.
    const clienteId = req.cliente.id;

    const [pedidoResult] = await connection.query(
      `INSERT INTO pedidos
        (cliente_id, numero_pedido, cliente_nome, cliente_telefone, cliente_email,
         endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
         subtotal, frete, total, tipo_pedido, status, forma_pagamento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?)`,
      [
        clienteId,
        numeroPedido,
        cliente_nome,
        cliente_telefone,
        cliente_email || null,
        endereco_rua || null,
        endereco_numero || null,
        endereco_bairro || null,
        endereco_cidade || null,
        (endereco_estado || '').toUpperCase(),
        endereco_cep || null,
        subtotal,
        frete,
        total,
        tipoPedido,
        forma_pagamento || 'mercado_pago',
      ]
    );

    const pedidoId = pedidoResult.insertId;

    for (const item of itensProcessados) {
      await connection.query(
        `INSERT INTO pedido_itens
          (pedido_id, produto_id, nome_produto, tamanho, cor, quantidade, preco_unitario, preco_custo_unitario, subtotal, tipo_preco)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pedidoId,
          item.produto_id,
          item.nome_produto,
          item.tamanho,
          item.cor,
          item.quantidade,
          item.preco_unitario,
          item.preco_custo_unitario,
          item.subtotal,
          item.tipo_preco,
        ]
      );
    }

    // Não criamos mais uma "preferência" com redirecionamento aqui: o
    // pagamento agora acontece de forma invisível, direto na página de
    // checkout (Payment Brick). Se o gateway estiver ativo, o pedido fica
    // "pendente" até o front chamar POST /api/pagamentos/processar com os
    // dados do Brick. Se estiver em modo simulado, aprova na hora.
    if (!MP_ATIVO) {
      await connection.query('UPDATE pedidos SET status = ? WHERE id = ?', ['pago', pedidoId]);
    }

    await connection.commit();

    res.status(201).json({
      message: MP_ATIVO
        ? 'Pedido criado! Complete o pagamento na tela a seguir.'
        : 'Pedido realizado com sucesso!',
      numero_pedido: numeroPedido,
      subtotal,
      frete,
      total,
      requer_pagamento: MP_ATIVO, // se true, o front deve exibir o Payment Brick
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

// Consulta pública de um pedido pelo número (usado na página de confirmação)
async function getOrderByNumber(req, res, next) {
  try {
    const { numero } = req.params;
    const [pedidos] = await pool.query('SELECT * FROM pedidos WHERE numero_pedido = ?', [numero]);

    if (pedidos.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const [itens] = await pool.query('SELECT * FROM pedido_itens WHERE pedido_id = ?', [
      pedidos[0].id,
    ]);

    res.json({ ...pedidos[0], itens });
  } catch (err) {
    next(err);
  }
}

// ---------- ADMIN ----------

async function listOrders(req, res, next) {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM pedidos';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY criado_em DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const [pedidos] = await pool.query('SELECT * FROM pedidos WHERE id = ?', [id]);
    if (pedidos.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    const [itens] = await pool.query('SELECT * FROM pedido_itens WHERE pedido_id = ?', [id]);
    res.json({ ...pedidos[0], itens });
  } catch (err) {
    next(err);
  }
}

const STATUS_VALIDOS = ['pendente', 'pago', 'enviado', 'entregue', 'cancelado'];

async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({
        error: `Status inválido. Use um dos seguintes: ${STATUS_VALIDOS.join(', ')}.`,
      });
    }

    await pool.query('UPDATE pedidos SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Status do pedido atualizado com sucesso.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  getOrderByNumber,
  listOrders,
  getOrderById,
  updateOrderStatus,
};
