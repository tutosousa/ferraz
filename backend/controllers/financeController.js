const { pool } = require('../config/db');

// Resumo financeiro dentro de um período (padrão: últimos 30 dias).
// Faturamento = soma dos pedidos pagos/enviados/entregues no período.
// Custos = custo dos produtos vendidos (COGS) + despesas manuais lançadas.
// Lucro = Faturamento - Custos.
async function getSummary(req, res, next) {
  try {
    const inicio = req.query.inicio || defaultInicio();
    const fim = req.query.fim || todayISO();

    const [[faturamento]] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS valor
       FROM pedidos
       WHERE status IN ('pago', 'enviado', 'entregue')
         AND DATE(criado_em) BETWEEN ? AND ?`,
      [inicio, fim]
    );

    const [[custoProdutos]] = await pool.query(
      `SELECT COALESCE(SUM(pi.preco_custo_unitario * pi.quantidade), 0) AS valor
       FROM pedido_itens pi
       JOIN pedidos p ON p.id = pi.pedido_id
       WHERE p.status IN ('pago', 'enviado', 'entregue')
         AND DATE(p.criado_em) BETWEEN ? AND ?`,
      [inicio, fim]
    );

    const [[despesasManuais]] = await pool.query(
      `SELECT COALESCE(SUM(valor), 0) AS valor
       FROM financeiro_lancamentos
       WHERE tipo = 'despesa' AND data BETWEEN ? AND ?`,
      [inicio, fim]
    );

    const [[receitasManuais]] = await pool.query(
      `SELECT COALESCE(SUM(valor), 0) AS valor
       FROM financeiro_lancamentos
       WHERE tipo = 'receita' AND data BETWEEN ? AND ?`,
      [inicio, fim]
    );

    const totalFaturamento = Number(faturamento.valor) + Number(receitasManuais.valor);
    const totalCustos = Number(custoProdutos.valor) + Number(despesasManuais.valor);
    const lucro = totalFaturamento - totalCustos;

    res.json({
      periodo: { inicio, fim },
      faturamento: round2(totalFaturamento),
      custos: round2(totalCustos),
      lucro: round2(lucro),
      detalhes: {
        vendas_pedidos: round2(faturamento.valor),
        custo_produtos_vendidos: round2(custoProdutos.valor),
        despesas_manuais: round2(despesasManuais.valor),
        receitas_manuais: round2(receitasManuais.valor),
      },
    });
  } catch (err) {
    next(err);
  }
}

// Faturamento agrupado por semana (últimas 8 semanas) para gráficos/tabelas
async function getWeeklyReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
          YEARWEEK(criado_em, 3) AS semana_ano,
          MIN(DATE(criado_em)) AS inicio_semana,
          COALESCE(SUM(total), 0) AS faturamento
       FROM pedidos
       WHERE status IN ('pago', 'enviado', 'entregue')
         AND criado_em >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
       GROUP BY semana_ano
       ORDER BY semana_ano ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// Faturamento agrupado por mês (últimos 12 meses)
async function getMonthlyReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
          DATE_FORMAT(criado_em, '%Y-%m') AS mes,
          COALESCE(SUM(total), 0) AS faturamento
       FROM pedidos
       WHERE status IN ('pago', 'enviado', 'entregue')
         AND criado_em >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY mes
       ORDER BY mes ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ---------- Lançamentos manuais (despesas fixas, receitas extras, etc.) ----------

async function listLancamentos(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM financeiro_lancamentos ORDER BY data DESC, id DESC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createLancamento(req, res, next) {
  try {
    const { tipo, descricao, valor, data } = req.body;

    if (!['receita', 'despesa'].includes(tipo) || !descricao || !valor || !data) {
      return res.status(400).json({
        error: 'Informe tipo (receita/despesa), descrição, valor e data.',
      });
    }

    const [result] = await pool.query(
      'INSERT INTO financeiro_lancamentos (tipo, descricao, valor, data) VALUES (?, ?, ?, ?)',
      [tipo, descricao, valor, data]
    );

    res.status(201).json({ id: result.insertId, message: 'Lançamento adicionado.' });
  } catch (err) {
    next(err);
  }
}

async function deleteLancamento(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM financeiro_lancamentos WHERE id = ?', [id]);
    res.json({ message: 'Lançamento removido.' });
  } catch (err) {
    next(err);
  }
}

function defaultInicio() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

module.exports = {
  getSummary,
  getWeeklyReport,
  getMonthlyReport,
  listLancamentos,
  createLancamento,
  deleteLancamento,
};
