const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const {
  getSummary,
  getWeeklyReport,
  getMonthlyReport,
  listLancamentos,
  createLancamento,
  deleteLancamento,
} = require('../controllers/financeController');

// Todas as rotas financeiras exigem login de admin
router.use(requireAdminAuth);

router.get('/resumo', getSummary);
router.get('/semanal', getWeeklyReport);
router.get('/mensal', getMonthlyReport);

router.get('/lancamentos', listLancamentos);
router.post('/lancamentos', createLancamento);
router.delete('/lancamentos/:id', deleteLancamento);

module.exports = router;
