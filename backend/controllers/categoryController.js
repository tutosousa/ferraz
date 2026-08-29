const { pool } = require('../config/db');

function gerarSlug(nome) {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Lista todas as categorias (público - usado no menu da loja)
async function listCategories(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, nome, slug FROM categorias ORDER BY nome ASC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// Lista categorias para o admin, já com a contagem de produtos de cada uma
// (útil pra saber se dá pra excluir sem quebrar nada)
async function listCategoriesAdmin(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.nome, c.slug, COUNT(p.id) AS total_produtos
      FROM categorias c
      LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo = 1
      GROUP BY c.id
      ORDER BY c.nome ASC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// Cria uma nova categoria (admin)
async function createCategory(req, res, next) {
  try {
    const { nome } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'O nome da categoria é obrigatório.' });
    }

    const slug = gerarSlug(nome);

    const [result] = await pool.query(
      'INSERT INTO categorias (nome, slug) VALUES (?, ?)',
      [nome.trim(), slug]
    );

    res.status(201).json({ id: result.insertId, nome: nome.trim(), slug });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });
    }
    next(err);
  }
}

// Edita o nome de uma categoria existente (admin)
async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { nome } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'O nome da categoria é obrigatório.' });
    }

    const slug = gerarSlug(nome);

    await pool.query('UPDATE categorias SET nome = ?, slug = ? WHERE id = ?', [
      nome.trim(),
      slug,
      id,
    ]);

    res.json({ message: 'Categoria atualizada com sucesso.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });
    }
    next(err);
  }
}

// Exclui uma categoria (admin)
async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM categorias WHERE id = ?', [id]);
    res.json({ message: 'Categoria removida com sucesso.' });
  } catch (err) {
    // A categoria tem produtos vinculados (o banco impede a exclusão pra
    // não deixar produtos "órfãos", sem categoria nenhuma).
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({
        error: 'Não é possível excluir esta categoria porque ainda existem produtos nela. Mova ou exclua os produtos primeiro.',
      });
    }
    next(err);
  }
}

module.exports = {
  listCategories,
  listCategoriesAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
};
