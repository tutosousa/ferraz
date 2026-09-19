const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const {
  listCategories,
  listCategoriesAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');

// Pública
router.get('/', listCategories);

// Admin
router.get('/admin/all', requireAdminAuth, listCategoriesAdmin);
router.post('/', requireAdminAuth, createCategory);
router.put('/:id', requireAdminAuth, updateCategory);
router.delete('/:id', requireAdminAuth, deleteCategory);

module.exports = router;
