require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { testConnection } = require('./config/db');
const { testarConexaoEmail } = require('./config/email');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { sanitizeInputs } = require('./middleware/sanitize');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const financeRoutes = require('./routes/financeRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// O Render (e praticamente toda hospedagem em nuvem) coloca a aplicação
// atrás de um proxy reverso, que repassa o IP real do visitante no
// cabeçalho "X-Forwarded-For". Sem avisar o Express disso, o middleware de
// limite de tentativas (express-rate-limit) trava a requisição inteira com
// erro — é por isso que login, cadastro, etc paravam de funcionar quando
// publicado, mesmo funcionando perfeitamente local.
app.set('trust proxy', 1);

// ---------- Middlewares globais ----------

// Cabeçalhos de segurança HTTP (proteção contra clickjacking, sniffing de
// tipo de conteúdo, etc). Desligamos o CSP e o "cross-origin resource
// policy" padrão porque este servidor é uma API pura (não renderiza HTML)
// e precisa deixar o frontend, rodando em outra porta/domínio, carregar as
// fotos de produtos normalmente.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS: só permite requisições vindas do endereço do frontend configurado no .env
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Sanitização básica contra XSS em todo corpo de requisição recebido
app.use(sanitizeInputs);

// Serve as imagens de produtos enviadas via upload
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- Rotas da API ----------
app.use('/api/auth', authRoutes);
app.use('/api/clientes', customerRoutes);
app.use('/api/categorias', categoryRoutes);
app.use('/api/produtos', productRoutes);
app.use('/api/pedidos', orderRoutes);
app.use('/api/financeiro', financeRoutes);
app.use('/api/pagamentos', paymentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'FERRAZ E-commerce API' });
});

// ---------- Tratamento de erros ----------
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Alerta de segurança: um JWT_SECRET fraco ou ausente permite que qualquer
// pessoa forje tokens de login válidos. Isso não impede o servidor de
// rodar (para não travar testes locais), mas avisa bem claro no log.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 20) {
  console.warn(
    '\n⚠️  AVISO DE SEGURANÇA: JWT_SECRET ausente ou muito curto no .env. ' +
    'Gere uma chave longa e aleatória antes de publicar o site (veja o .env.example).\n'
  );
}

app.listen(PORT, async () => {
  console.log(`\n🟢 API FERRAZ rodando em http://localhost:${PORT}`);
  await testConnection();
  await testarConexaoEmail();
});
