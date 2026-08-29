const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  listPublicProducts,
  getPublicProduct,
  listAdminProducts,
  getAdminProduct,
  createProduct,
  updateProduct,
  deleteProductImage,
  setImagemCor,
  deleteProduct,
  createColor,
  updateColor,
  deleteColor,
  createSize,
  deleteSize,
} = require('../controllers/productController');

// Pública (loja)
router.get('/', listPublicProducts);
router.get('/:id', getPublicProduct);

// Admin (painel) - prefixo /admin para não colidir com as rotas públicas
router.get('/admin/all', requireAdminAuth, listAdminProducts);
router.get('/admin/:id', requireAdminAuth, getAdminProduct);
router.post('/admin', requireAdminAuth, upload.array('imagens', 8), createProduct);
router.put('/admin/:id', requireAdminAuth, upload.array('imagens', 8), updateProduct);
router.delete('/admin/:id', requireAdminAuth, deleteProduct);

// Fotos
router.delete('/admin/:id/imagens/:imagemId', requireAdminAuth, deleteProductImage);
router.put('/admin/:id/imagens/:imagemId/cor', requireAdminAuth, setImagemCor);

// Cores
router.post('/admin/:id/cores', requireAdminAuth, createColor);
router.put('/admin/:id/cores/:corId', requireAdminAuth, updateColor);
router.delete('/admin/:id/cores/:corId', requireAdminAuth, deleteColor);

// Tamanhos
router.post('/admin/:id/tamanhos', requireAdminAuth, createSize);
router.delete('/admin/:id/tamanhos/:tamanhoId', requireAdminAuth, deleteSize);

module.exports = router;
