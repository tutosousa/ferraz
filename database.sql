-- =====================================================================
-- FERRAZ E-COMMERCE - Script de banco de dados (MySQL)
-- =====================================================================
-- Como usar:
--   mysql -u root -p < database.sql
-- Isso cria o banco "ferraz_ecommerce", todas as tabelas e dados de
-- exemplo (categorias, produtos, um admin, pedidos e lançamentos
-- financeiros em semanas/meses diferentes) para você testar o sistema
-- imediatamente.
-- =====================================================================

-- Garante que o cliente MySQL envie/receba os dados em UTF-8, independente
-- da configuração padrão do terminal (evita acentos corrompidos no import).
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS ferraz_ecommerce
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ferraz_ecommerce;

-- ---------------------------------------------------------------------
-- Tabela: admins (usuários do painel administrativo)
-- ---------------------------------------------------------------------
CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: categorias
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: produtos
-- ---------------------------------------------------------------------
CREATE TABLE produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  categoria_id INT NOT NULL,
  preco_custo DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_varejo DECIMAL(10,2) NOT NULL,
  preco_atacado DECIMAL(10,2) DEFAULT NULL,
  desconto_atacado_percentual DECIMAL(5,2) NOT NULL DEFAULT 0,
  quantidade_minima_atacado INT NOT NULL DEFAULT 50,
  estoque INT NOT NULL DEFAULT 0,
  imagem_url VARCHAR(255) DEFAULT NULL,
  -- Peso e dimensões da embalagem, usados para calcular o frete real
  -- (Melhor Envio). Valores padrão razoáveis para uma peça de roupa dobrada.
  peso_kg DECIMAL(6,3) NOT NULL DEFAULT 0.3,
  altura_cm INT NOT NULL DEFAULT 5,
  largura_cm INT NOT NULL DEFAULT 25,
  comprimento_cm INT NOT NULL DEFAULT 35,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: clientes (contas de clientes da loja, separado dos admins)
-- ---------------------------------------------------------------------
CREATE TABLE clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  telefone VARCHAR(30) UNIQUE,
  email_verificado TINYINT(1) NOT NULL DEFAULT 0,
  endereco_rua VARCHAR(200),
  endereco_numero VARCHAR(20),
  endereco_bairro VARCHAR(100),
  endereco_cidade VARCHAR(100),
  endereco_estado CHAR(2),
  endereco_cep VARCHAR(12),
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: codigos_verificacao (códigos de 6 dígitos para confirmar
-- cadastro por e-mail e para o login em duas etapas / 2FA)
-- ---------------------------------------------------------------------
CREATE TABLE codigos_verificacao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  codigo VARCHAR(6) NOT NULL,
  tipo ENUM('cadastro', 'login') NOT NULL,
  usado TINYINT(1) NOT NULL DEFAULT 0,
  expira_em DATETIME NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: codigos_recuperacao_senha (recuperação de senha "esqueci minha
-- senha", compartilhada entre contas de admin e de cliente — o campo
-- "tipo" diz a qual das duas tabelas o usuario_id se refere)
-- ---------------------------------------------------------------------
CREATE TABLE codigos_recuperacao_senha (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('admin', 'cliente') NOT NULL,
  usuario_id INT NOT NULL,
  codigo VARCHAR(6) NOT NULL,
  usado TINYINT(1) NOT NULL DEFAULT 0,
  expira_em DATETIME NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: produto_cores (variações de cor de um produto, ex: Verde, Azul)
-- ---------------------------------------------------------------------
CREATE TABLE produto_cores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  nome VARCHAR(60) NOT NULL,
  codigo_hex VARCHAR(7) DEFAULT NULL, -- ex: #5EC5B5, usado pra mostrar a bolinha de cor
  ordem INT NOT NULL DEFAULT 0,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: produto_tamanhos (tamanhos disponíveis de um produto, ex: PP, P, M, G, GG)
-- ---------------------------------------------------------------------
CREATE TABLE produto_tamanhos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  tamanho VARCHAR(20) NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: produto_imagens (várias fotos por produto, além da capa —
-- cada foto pode opcionalmente estar vinculada a uma cor específica)
-- ---------------------------------------------------------------------
CREATE TABLE produto_imagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  imagem_url VARCHAR(255) NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  cor_id INT DEFAULT NULL,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  FOREIGN KEY (cor_id) REFERENCES produto_cores(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: pedidos
-- ---------------------------------------------------------------------
CREATE TABLE pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT DEFAULT NULL,
  numero_pedido VARCHAR(30) NOT NULL UNIQUE,
  cliente_nome VARCHAR(150) NOT NULL,
  cliente_telefone VARCHAR(30) NOT NULL,
  cliente_email VARCHAR(150),
  endereco_rua VARCHAR(200),
  endereco_numero VARCHAR(20),
  endereco_bairro VARCHAR(100),
  endereco_cidade VARCHAR(100),
  endereco_estado CHAR(2),
  endereco_cep VARCHAR(12),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  frete DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  tipo_pedido ENUM('varejo','atacado') NOT NULL DEFAULT 'varejo',
  status ENUM('pendente','pago','enviado','entregue','cancelado') NOT NULL DEFAULT 'pendente',
  forma_pagamento VARCHAR(50) DEFAULT 'simulado',
  mp_preference_id VARCHAR(120) DEFAULT NULL,
  mp_payment_id VARCHAR(120) DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: pedido_itens
-- ---------------------------------------------------------------------
CREATE TABLE pedido_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  produto_id INT,
  nome_produto VARCHAR(150) NOT NULL,
  tamanho VARCHAR(20) DEFAULT NULL,
  cor VARCHAR(60) DEFAULT NULL,
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  preco_custo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL,
  tipo_preco ENUM('varejo','atacado') NOT NULL DEFAULT 'varejo',
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: financeiro_lancamentos (receitas/despesas manuais)
-- ---------------------------------------------------------------------
CREATE TABLE financeiro_lancamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('receita','despesa') NOT NULL,
  descricao VARCHAR(200) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
-- DADOS DE EXEMPLO
-- =====================================================================

-- Admin de teste
-- Login: admin@ferraz.com  |  Senha: ferraz123
INSERT INTO admins (nome, email, senha_hash) VALUES
('Administrador FERRAZ', 'admin@ferraz.com', '$2a$10$nbxZLIaWTYQl.eB1iuPi7.PR9/3K1L0iFr/mMDJtWDU/.Dc9bR6Be');

-- Categorias
INSERT INTO categorias (nome, slug) VALUES
('Saias', 'saias'),
('Vestidos', 'vestidos'),
('Shorts', 'shorts'),
('Blusas', 'blusas'),
('Calças', 'calcas');

-- Produtos (preço de custo, varejo e atacado + regra de desconto no atacado)
-- No atacado, TODAS as peças custam R$ 35,00 fixo — o desconto % abaixo é
-- só informativo (calculado a partir do preço de varejo de cada peça).
INSERT INTO produtos
  (nome, descricao, categoria_id, preco_custo, preco_varejo, preco_atacado, desconto_atacado_percentual, quantidade_minima_atacado, estoque, imagem_url, ativo)
VALUES
('Conjunto Saia Midi Alfaiataria',
 'Conjunto de saia midi em alfaiataria com blazer combinando. No atacado, qualquer peça sai por R$ 35,00.',
 1, 65.00, 189.90, 35.00, 81.57, 50, 120, NULL, 1),

('Conjunto Saia Lápis Executiva',
 'Conjunto elegante de saia lápis e camisa para o dia a dia. No atacado, qualquer peça sai por R$ 35,00.',
 1, 58.00, 169.90, 35.00, 79.40, 50, 95, NULL, 1),

('Conjunto Vestido Longo Fluido',
 'Vestido longo fluido em tecido leve, ideal para o verão. No atacado, qualquer peça sai por R$ 35,00.',
 2, 70.00, 219.90, 35.00, 84.08, 50, 80, NULL, 1),

('Conjunto Vestido Tubinho Clássico',
 'Vestido tubinho atemporal, corte reto e sofisticado. No atacado, qualquer peça sai por R$ 35,00.',
 2, 62.00, 199.90, 35.00, 82.49, 50, 70, NULL, 1),

('Conjunto Short Alfaiataria Cintura Alta',
 'Conjunto de short de alfaiataria com cinto e blazer. No atacado, qualquer peça sai por R$ 35,00.',
 3, 55.00, 159.90, 35.00, 78.11, 50, 110, NULL, 1),

('Conjunto Short Linho Casual',
 'Conjunto casual em linho, leve e confortável para o dia a dia. No atacado, qualquer peça sai por R$ 35,00.',
 3, 48.00, 139.90, 35.00, 74.98, 50, 130, NULL, 1),

('Blusa Cropped Manga Longa',
 'Blusa cropped básica em malha premium. No atacado, qualquer peça sai por R$ 35,00.',
 4, 22.00, 79.90, 35.00, 56.20, 50, 200, NULL, 1),

('Blusa Social Manga Bufante',
 'Blusa social com manga bufante, ideal para compor looks executivos. No atacado, qualquer peça sai por R$ 35,00.',
 4, 28.00, 99.90, 35.00, 64.96, 50, 150, NULL, 1),

('Calça Pantalona Alfaiataria',
 'Calça pantalona de alfaiataria com cintura alta. No atacado, qualquer peça sai por R$ 35,00.',
 5, 45.00, 149.90, 35.00, 76.65, 50, 140, NULL, 1),

('Calça Reta Premium',
 'Calça reta de tecido premium, caimento perfeito. No atacado, qualquer peça sai por R$ 35,00.',
 5, 42.00, 139.90, 35.00, 74.98, 50, 160, NULL, 1);

-- Pedidos de exemplo (com datas variadas nos últimos ~2 meses para
-- alimentar os relatórios semanais e mensais do painel financeiro)
INSERT INTO pedidos
  (numero_pedido, cliente_nome, cliente_telefone, cliente_email,
   endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
   subtotal, frete, total, tipo_pedido, status, forma_pagamento, criado_em)
VALUES
('FRZ-00000001', 'Marcela Andrade', '(81) 99876-5432', 'marcela.andrade@email.com',
 'Rua das Flores', '120', 'Centro', 'Surubim', 'PE', '55750-000',
 379.80, 15.00, 394.80, 'varejo', 'entregue', 'simulado', DATE_SUB(NOW(), INTERVAL 55 DAY)),

('FRZ-00000002', 'Renata Silva', '(11) 98765-4321', 'renata.silva@email.com',
 'Av. Paulista', '900', 'Bela Vista', 'São Paulo', 'SP', '01310-000',
 599.60, 30.00, 629.60, 'varejo', 'entregue', 'simulado', DATE_SUB(NOW(), INTERVAL 48 DAY)),

('FRZ-00000003', 'Juliana Costa', '(21) 97654-3210', 'juliana.costa@email.com',
 'Rua do Catete', '55', 'Catete', 'Rio de Janeiro', 'RJ', '22220-000',
 219.90, 30.00, 249.90, 'varejo', 'entregue', 'simulado', DATE_SUB(NOW(), INTERVAL 40 DAY)),

('FRZ-00000004', 'Fernanda Lima', '(85) 96543-2109', 'fernanda.lima@email.com',
 'Av. Beira Mar', '300', 'Meireles', 'Fortaleza', 'CE', '60165-000',
 1750.00, 0.00, 1750.00, 'atacado', 'entregue', 'simulado', DATE_SUB(NOW(), INTERVAL 33 DAY)),


('FRZ-00000005', 'Patrícia Souza', '(41) 95432-1098', 'patricia.souza@email.com',
 'Rua XV de Novembro', '210', 'Centro', 'Curitiba', 'PR', '80020-000',
 279.80, 40.00, 319.80, 'varejo', 'enviado', 'simulado', DATE_SUB(NOW(), INTERVAL 25 DAY)),

('FRZ-00000006', 'Camila Ferreira', '(62) 94321-0987', 'camila.ferreira@email.com',
 'Av. Goiás', '75', 'Setor Central', 'Goiânia', 'GO', '74010-000',
 169.90, 35.00, 204.90, 'varejo', 'pago', 'simulado', DATE_SUB(NOW(), INTERVAL 18 DAY)),

('FRZ-00000007', 'Aline Rocha', '(81) 93210-9876', 'aline.rocha@email.com',
 'Rua Nova', '18', 'Centro', 'Surubim', 'PE', '55750-000',
 259.80, 15.00, 274.80, 'varejo', 'pago', 'simulado', DATE_SUB(NOW(), INTERVAL 10 DAY)),

('FRZ-00000008', 'Beatriz Martins', '(51) 92109-8765', 'beatriz.martins@email.com',
 'Av. Ipiranga', '450', 'Centro Histórico', 'Porto Alegre', 'RS', '90160-000',
 139.90, 40.00, 179.90, 'varejo', 'pendente', 'simulado', DATE_SUB(NOW(), INTERVAL 4 DAY)),

('FRZ-00000009', 'Larissa Nunes', '(31) 91098-7654', 'larissa.nunes@email.com',
 'Av. Afonso Pena', '620', 'Centro', 'Belo Horizonte', 'MG', '30130-000',
 99.90, 30.00, 129.90, 'varejo', 'pago', 'simulado', DATE_SUB(NOW(), INTERVAL 1 DAY)),

('FRZ-00000010', 'Vanessa Alves', '(81) 90987-6543', 'vanessa.alves@email.com',
 'Rua da Aurora', '88', 'Boa Vista', 'Recife', 'PE', '50050-000',
 189.90, 15.00, 204.90, 'varejo', 'cancelado', 'simulado', NOW());

-- Cliente de teste (para login em cadastro.html / login.html na loja)
-- Login: cliente@teste.com | Senha: cliente123
INSERT INTO clientes (nome, email, senha_hash, telefone, email_verificado, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep) VALUES
('Cliente Teste', 'cliente@teste.com', '$2a$10$InO2xTEjCL.LK6Es2aO0V.uUzWs2l/SAs8A5UXrAkLi0YFwGqd2Zm', '(81) 98888-7777', 1, 'Rua Exemplo', '100', 'Centro', 'Surubim', 'PE', '55750-000');

-- Itens dos pedidos (referenciando os produtos inseridos acima)
INSERT INTO pedido_itens (pedido_id, produto_id, nome_produto, quantidade, preco_unitario, preco_custo_unitario, subtotal, tipo_preco) VALUES
(1, 1, 'Conjunto Saia Midi Alfaiataria', 2, 189.90, 65.00, 379.80, 'varejo'),

(2, 3, 'Conjunto Vestido Longo Fluido', 1, 219.90, 70.00, 219.90, 'varejo'),
(2, 9, 'Calça Pantalona Alfaiataria', 1, 149.90, 45.00, 149.90, 'varejo'),
(2, 7, 'Blusa Cropped Manga Longa', 1, 79.90, 22.00, 79.90, 'varejo'),
(2, 8, 'Blusa Social Manga Bufante', 1, 149.90, 28.00, 149.90, 'varejo'),

(3, 4, 'Conjunto Vestido Tubinho Clássico', 1, 219.90, 62.00, 219.90, 'varejo'),

(4, 6, 'Conjunto Short Linho Casual', 50, 35.00, 48.00, 1750.00, 'atacado'),

(5, 5, 'Conjunto Short Alfaiataria Cintura Alta', 1, 159.90, 55.00, 159.90, 'varejo'),
(5, 7, 'Blusa Cropped Manga Longa', 1, 79.90, 22.00, 79.90, 'varejo'),

(6, 2, 'Conjunto Saia Lápis Executiva', 1, 169.90, 58.00, 169.90, 'varejo'),

(7, 10, 'Calça Reta Premium', 1, 139.90, 42.00, 139.90, 'varejo'),
(7, 7, 'Blusa Cropped Manga Longa', 1, 79.90, 22.00, 79.90, 'varejo'),

(8, 6, 'Conjunto Short Linho Casual', 1, 139.90, 48.00, 139.90, 'varejo'),

(9, 7, 'Blusa Cropped Manga Longa', 1, 99.90, 22.00, 99.90, 'varejo'),

(10, 1, 'Conjunto Saia Midi Alfaiataria', 1, 189.90, 65.00, 189.90, 'varejo');

-- Lançamentos financeiros manuais (despesas fixas e receitas extras),
-- espalhados em semanas e meses diferentes para popular o painel financeiro
INSERT INTO financeiro_lancamentos (tipo, descricao, valor, data) VALUES
('despesa', 'Aluguel do ateliê', 1800.00, DATE_SUB(CURDATE(), INTERVAL 55 DAY)),
('despesa', 'Anúncios Instagram/Facebook', 450.00, DATE_SUB(CURDATE(), INTERVAL 50 DAY)),
('despesa', 'Compra de tecidos e aviamentos', 2200.00, DATE_SUB(CURDATE(), INTERVAL 45 DAY)),
('despesa', 'Aluguel do ateliê', 1800.00, DATE_SUB(CURDATE(), INTERVAL 25 DAY)),
('despesa', 'Anúncios Instagram/Facebook', 600.00, DATE_SUB(CURDATE(), INTERVAL 20 DAY)),
('despesa', 'Embalagens personalizadas', 320.00, DATE_SUB(CURDATE(), INTERVAL 12 DAY)),
('despesa', 'Aluguel do ateliê', 1800.00, DATE_SUB(CURDATE(), INTERVAL 5 DAY)),
('receita', 'Venda direta no showroom (dinheiro)', 450.00, DATE_SUB(CURDATE(), INTERVAL 15 DAY)),
('receita', 'Comissão de indicação de fornecedor', 200.00, DATE_SUB(CURDATE(), INTERVAL 3 DAY));

-- =====================================================================
-- Fim do script
-- =====================================================================
