// Configuração da conexão com o banco de dados MySQL
// Usa um "pool" de conexões, que é a forma recomendada para aplicações
// em produção: reaproveita conexões em vez de abrir uma nova a cada consulta.

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ferraz_ecommerce',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  // Bancos de dados na nuvem (Aiven, PlanetScale, etc.) normalmente exigem
  // conexão criptografada. Defina DB_SSL=true no .env quando usar um banco
  // remoto. Em desenvolvimento local (XAMPP/MySQL na sua máquina) deixe
  // DB_SSL de fora ou como "false".
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

// Testa a conexão assim que o servidor sobe, para dar um erro claro
// caso as credenciais do .env estejam erradas.
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Conectado ao MySQL com sucesso (banco: %s)', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('❌ Falha ao conectar ao MySQL:', err.message);
    console.error('   Verifique se o MySQL está rodando e se o arquivo .env está correto.');
  }
}

module.exports = { pool, testConnection };
