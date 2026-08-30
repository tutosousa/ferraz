# FERRAZ — Sistema de E-commerce

Sistema completo de loja virtual + painel administrativo para a marca de moda **FERRAZ**, testado de ponta a ponta (banco de dados, API e fluxo de compra).

- **Frontend:** HTML, CSS e JavaScript puro (sem frameworks/build step)
- **Backend:** Node.js + Express
- **Banco de dados:** MySQL / MariaDB

---

## 1. Estrutura de pastas

```
ferraz/
├── backend/            → API Node.js (Controllers, Models via SQL, Routes, Config)
│   ├── config/          → conexão com o banco (db.js) e cliente do Mercado Pago (mercadopago.js)
│   ├── middleware/      → autenticação admin, autenticação cliente, upload, sanitização, erros
│   ├── controllers/     → produtos, categorias, pedidos, financeiro, auth admin, auth cliente, pagamento
│   ├── routes/
│   ├── uploads/products/  → fotos de produtos enviadas pelo admin
│   ├── server.js
│   └── .env.example
├── frontend/
│   ├── index.html        → loja (varejo)
│   ├── atacado.html       → loja (atacado), com banner e pedido mínimo de 50 peças
│   ├── produto.html       → ficha de produto com galeria de fotos
│   ├── carrinho.html, checkout.html, pedido-sucesso.html
│   ├── login.html, cadastro.html, conta.html  → contas de cliente
│   ├── css/style.css
│   ├── js/api.js, js/cart.js, js/customer.js
│   ├── assets/logo.png
│   ├── serve.json        → configuração do `npx serve` (não mexer — corrige um bug de navegação)
│   └── admin/             → painel administrativo (login, dashboard, produtos, pedidos, financeiro)
└── database.sql          → schema + dados de exemplo
```

---

## 2. Pré-requisitos

- [Node.js](https://nodejs.org) 18 ou superior
- MySQL 8+ ou MariaDB 10.6+ instalado e rodando
- Um servidor estático simples para o frontend (o navegador não abre `fetch` de arquivos `file://` corretamente). Sugestões: extensão "Live Server" do VS Code, ou `npx serve`, ou `python3 -m http.server`.

---

## 3. Passo a passo para rodar localmente

### 3.1. Criar o banco de dados

```bash
mysql -u root -p < database.sql
```

Isso cria o banco `ferraz_ecommerce`, todas as tabelas e dados de exemplo:
- 1 usuário admin (login: `admin@ferraz.com` / senha: `ferraz123`)
- 5 categorias, 10 produtos com preço de custo/varejo/atacado
- 10 pedidos de exemplo com datas variadas (para testar os relatórios)
- Lançamentos financeiros manuais em semanas/meses diferentes

> **Importante:** o script já inclui `SET NAMES utf8mb4;` para preservar acentos corretamente. Se preferir importar manualmente, garanta o charset UTF-8: `mysql -u root --default-character-set=utf8mb4 < database.sql`.

### 3.2. Configurar e rodar o backend

```bash
cd backend
npm install
cp .env.example .env
```

Abra o arquivo `.env` e preencha com as credenciais do seu MySQL:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_aqui
DB_NAME=ferraz_ecommerce
PORT=5000
JWT_SECRET=troque_esta_chave_por_uma_bem_grande_e_aleatoria
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://localhost:8080
```

Depois, inicie o servidor:

```bash
npm start
```

Se tudo estiver certo, você verá no terminal:
```
🟢 API FERRAZ rodando em http://localhost:5000
✅ Conectado ao MySQL com sucesso (banco: ferraz_ecommerce)
```

Teste rapidamente se a API está de pé, abrindo no navegador: `http://localhost:5000/api/health`

### 3.3. Rodar o frontend

Em outro terminal, dentro da pasta `frontend/`:

```bash
cd frontend
npx serve -l 8080
```

(ou qualquer outro servidor estático de sua preferência, na porta 8080 — que é o valor configurado em `FRONTEND_URL` no `.env`)

Depois acesse:
- **Loja virtual:** http://localhost:8080/index.html
- **Painel admin:** http://localhost:8080/admin/login.html

---

## 4. Contas de teste

**Painel administrativo:**
```
E-mail: admin@ferraz.com
Senha:  ferraz123
```

**Conta de cliente (loja):**
```
E-mail: cliente@teste.com
Senha:  cliente123
```
(essa conta já vem com o e-mail marcado como confirmado no banco de dados de exemplo, mas o login em duas etapas continua pedindo o código — se o e-mail (SMTP) não estiver configurado, o código aparece na própria tela em um aviso amarelo)

Troque essas senhas assim que possível em produção.

---

## 5. O que já vem pronto para testar

**Loja (varejo) — `index.html`:**
- Navegação por categoria (funcionando de verdade — veja a nota importante na seção 5.1 abaixo)
- Ficha de produto com **galeria de várias fotos**, seletor de **cor** (troca a galeria automaticamente pras fotos daquela cor) e seletor de **tamanho** (PP, P, M, G, GG — configuráveis por produto), com aviso obrigatório se tentar comprar sem selecionar
- Página de erro 404 personalizada com a cara da marca (`frontend/404.html`)
- Carrinho com cálculo de subtotal, checkout com frete fixo por estado
- Criação de conta e login de cliente, com **confirmação por e-mail e login em duas etapas (2FA)** — veja a seção 7.1
- Telefone único: não é possível cadastrar duas contas com o mesmo número
- Medidor de força de senha e confirmação de senha no cadastro
- **Login obrigatório para comprar** (varejo e atacado): sem conta, o cliente é levado pro login/cadastro e volta automaticamente pro checkout depois de entrar; nome e e-mail do pedido sempre vêm da conta logada (não dá pra digitar em nome de outra pessoa)
- "Minha conta": editar dados, endereço, e ver histórico de pedidos

**Loja de atacado — `atacado.html`:**
- Banner chamativo, preço fixo de R$ 35 por peça (ajustável por produto no admin)
- Pedido mínimo de 12 peças no TOTAL do carrinho (pode misturar modelos diferentes)
- Sem frete fixo (combinado à parte com o cliente)

**Frete real — Melhor Envio:**
- Cotação com várias transportadoras (Correios, Jadlog, etc), com preço e prazo reais, direto no checkout — veja a seção 8
- Enquanto não configurado, funciona em modo simulado (frete fixo por região) para você testar e demonstrar

**Pagamento — checkout invisível:**
- O cliente paga (Pix, cartão ou boleto) **sem sair do site**, direto na página de checkout — veja a seção 7
- Enquanto não configurado, funciona em modo simulado (aprova na hora, sem cobrança real) para você testar e demonstrar

**Admin:**
- CRUD completo de produtos, com **upload de várias fotos por produto** (e remoção individual de cada foto)
- Aba de **Categorias**: criar, editar e excluir quantas categorias quiser (não é possível excluir uma categoria que ainda tem produtos, pra não deixar nada "órfão")
- Gestão de **cores e tamanhos** por produto: adicione quantas cores e tamanhos quiser, e vincule fotos específicas a cada cor (basta escolher a cor no menu que aparece embaixo de cada foto já enviada)
- Gestão de pedidos com atualização de status (mostra se é pedido de varejo ou atacado)
- Aba financeira com faturamento/custo/lucro por período, relatório semanal e mensal
- Menu lateral responsivo (vira gaveta com botão hambúrguer no celular)

### 5.1 Importante: sobre os botões de categoria (bug real que corrigimos)

Se você notou que os botões de categoria pareciam "não fazer nada" ao clicar, o motivo era este: o comando `npx serve` (usado para rodar o frontend localmente) tem, por padrão, um recurso de "URL limpa" que redireciona `pagina.html?categoria=x` para `pagina` **e descarta o parâmetro** nesse processo. Isso fazia o clique navegar, mas sempre voltando pra lista completa, sem filtrar nada.

Corrigimos isso com um arquivo `frontend/serve.json` que desliga esse comportamento. **Esse arquivo já vem incluído no pacote — não precisa fazer nada, só usar o `npx serve` normalmente que a partir de agora funciona certo.** Testamos clicando de verdade num navegador (não só olhando o código) pra confirmar que o filtro agora funciona.

---

## 6. Segurança implementada

- Senhas de admin e de clientes com hash **bcrypt** (nunca texto puro)
- Autenticação via **JWT**, com tokens de admin e de cliente separados (um não funciona no lugar do outro)
- **Confirmação de cadastro por e-mail** e **login em duas etapas (2FA)** para contas de cliente
- **Recuperação de senha por e-mail** ("Esqueci minha senha"), tanto para admin quanto para cliente — veja a seção 7.2
- A recuperação de senha **nunca revela se um e-mail está cadastrado ou não** (mesma resposta em ambos os casos, evitando que alguém descubra quais contas existem)
- Códigos de verificação (cadastro, login, recuperação de senha) expiram em 10 minutos e não podem ser reutilizados
- Telefone único por conta de cliente (bloqueia duplicação)
- **Limite de tentativas (rate limiting)** em login, códigos de verificação e pedidos de recuperação de senha — dificulta ataques de força bruta (ex: tentar adivinhar senha ou código repetidamente)
- **Cabeçalhos de segurança HTTP** via `helmet` (proteção contra clickjacking, sniffing de tipo de conteúdo, etc.)
- Alerta automático no log do servidor se o `JWT_SECRET` estiver ausente ou fraco
- A tela de login do admin **não exibe mais nenhuma credencial de exemplo** (removido antes de ir para produção)
- Todas as consultas usam **prepared statements** (`mysql2`), prevenindo SQL Injection
- Sanitização básica de entrada contra **XSS** em todo corpo de requisição
- Validação de dados no backend (nunca confia em preços/valores enviados pelo frontend — o servidor sempre recalcula com base no banco, inclusive no momento de processar o pagamento)
- Upload de imagens restrito a tipos de imagem válidos, limite de 5MB por arquivo, até 8 fotos por produto
- CORS restrito ao endereço do frontend configurado no `.env`
- Dados de cartão nunca passam pelo nosso servidor: o checkout invisível usa o SDK do Mercado Pago para tokenizar o cartão direto no navegador do cliente

---

## 7. Ativando o pagamento de verdade (Mercado Pago — checkout invisível)

O checkout é **invisível**: o cliente escolhe Pix, cartão ou boleto e paga **sem sair do site da FERRAZ** (nenhum redirecionamento para o Mercado Pago). Isso usa o **Payment Brick** do Mercado Pago, embutido direto na página de checkout.

Enquanto as chaves não são configuradas, o site roda em **modo simulado**: os pedidos são aprovados automaticamente, sem nenhuma cobrança real — assim dá pra testar e demonstrar a loja inteira antes de ativar o gateway de verdade.

### Passo a passo para ativar (isso quem faz é o DONO DA LOJA, é a conta dele que recebe o dinheiro):

1. Criar uma conta em **https://www.mercadopago.com.br**
2. Acessar **https://www.mercadopago.com.br/developers/panel**
3. Criar uma aplicação (nome qualquer, tipo de integração: "Checkout Transparente" ou "Pagamentos online", API integrada: **Pagamentos**)
4. Na aplicação, ir em **Credenciais de produção** e copiar duas chaves:
   - **Access Token** (fica só no backend, nunca é exposto)
   - **Public Key** (usada no navegador do cliente para desenhar o formulário de pagamento — não é secreta)
5. Colar as duas no `.env` do backend:
   ```
   MP_ACCESS_TOKEN=o_access_token_copiado_aqui
   MP_PUBLIC_KEY=a_public_key_copiada_aqui
   ```
6. Se o backend já estiver publicado (não local), preencher também:
   ```
   BACKEND_URL=https://endereco-do-seu-backend.onrender.com
   ```
   (necessário pro Mercado Pago conseguir avisar automaticamente sobre pagamentos de Pix/boleto que demoram a confirmar)
7. Reiniciar o backend (`Ctrl+C` e `npm start` de novo)

A partir daí, o formulário de pagamento (cartão, Pix com QR code, ou boleto) aparece direto na página de checkout da loja, e o dinheiro cai direto na conta do dono da loja. Pagamentos com cartão são confirmados na hora; Pix e boleto ficam "pendente" até serem compensados (o site já trata isso, mostrando o QR code / link do boleto na tela).

**Testando antes de ir para produção:** use as **Credenciais de teste** (mesma tela, começam com `TEST-`) em vez das de produção, e os [cartões de teste do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards) para simular aprovação/recusa sem gastar dinheiro real.

---

## 7.1. Contas de cliente: confirmação por e-mail e login em duas etapas (2FA)

- Ao criar uma conta, a pessoa recebe um **código de 6 dígitos por e-mail** que precisa digitar para confirmar o cadastro (a conta só é liberada para login depois disso).
- Todo login pede senha **e depois** um segundo código de acesso enviado por e-mail (2FA) — só depois de confirmar os dois a pessoa entra na conta.
- Números de telefone são **únicos**: não é possível cadastrar duas contas com o mesmo telefone.

**Sobre SMS:** verificação por SMS foi propositalmente deixada de fora, porque exige contratar um serviço pago (tipo Twilio) com custo por mensagem enviada — e-mail cobre a mesma necessidade sem custo.

### Ativando o envio real de e-mails

Sem configuração nenhuma, o site roda em **modo simulado**: o código de verificação aparece na própria tela (com um aviso amarelo "modo de teste") em vez de ser enviado por e-mail — ótimo pra testar localmente sem precisar configurar nada.

**Importante se for publicar no Render (plano grátis):** desde setembro de 2025, o Render **bloqueia as portas de e-mail tradicional (SMTP)** no plano gratuito, por padrão de segurança deles — não é um bug do nosso código, é uma política deles pra evitar spam. Por isso, o sistema tem dois jeitos de enviar e-mail, e você deve escolher conforme onde for rodar:

**Opção recomendada (funciona em qualquer lugar, inclusive Render grátis) — API do Brevo:**
1. Crie uma conta grátis em **https://www.brevo.com** (300 e-mails grátis por dia)
2. Vá em **Configurações** → **"SMTP & API"** → aba **"Chaves API e MCP"**
3. Gere uma nova chave (**atenção:** é diferente da chave/login SMTP — essa é uma chave de API separada)
4. Preencha no `.env` do backend:
   ```
   BREVO_API_KEY=a_chave_de_api_gerada
   SMTP_FROM="FERRAZ <ferrazcollection@icloud.com>"
   ```
   (o `SMTP_FROM` continua sendo usado só pra definir o nome/e-mail que aparece como remetente, mesmo usando a API)
5. Reinicie o backend

**Opção alternativa (só funciona rodando local, ou em hospedagem paga) — SMTP tradicional:**

Se estiver só testando no seu computador (XAMPP), o SMTP tradicional funciona sem problema — use uma conta do Gmail:

1. Use (ou crie) uma conta do Gmail para a loja
2. Ative a **verificação em duas etapas** na conta Google (obrigatório para o próximo passo)
3. Gere uma **senha de app** em **https://myaccount.google.com/apppasswords**
4. Preencha no `.env` do backend:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=seuemail@gmail.com
   SMTP_PASS=a senha de app gerada (16 letras, sem espaços)
   SMTP_FROM="FERRAZ <seuemail@gmail.com>"
   ```
5. Reiniciar o backend

---

## 7.2. Recuperação de senha ("Esqueci minha senha")

Tanto o painel administrativo quanto as contas de cliente têm uma tela de recuperação de senha:

- **Cliente:** `frontend/esqueci-senha.html` (link já aparece na tela de login da loja)
- **Admin:** `frontend/admin/esqueci-senha.html` (link já aparece na tela de login do painel)

O fluxo é: a pessoa digita o e-mail → recebe um código de 6 dígitos (por e-mail, ou na tela em modo simulado, seguindo a mesma configuração de SMTP da seção 7.1) → digita o código junto com a nova senha (com medidor de força e confirmação, igual ao cadastro) → a senha é trocada e ela volta pra tela de login.

**Detalhe de segurança importante:** por padrão, telas de "esqueci minha senha" mal feitas revelam se um e-mail está cadastrado ou não (respondendo coisas diferentes tipo "e-mail não encontrado" vs "código enviado"). Aqui isso foi evitado de propósito — a resposta é sempre a mesma, tenha o e-mail conta ou não.

---

## 8. Frete — cotação real com o Melhor Envio

O checkout de **varejo** mostra opções de frete de verdade (transportadora, prazo e preço), consultadas em tempo real no **Melhor Envio** — o mesmo agregador de fretes (Correios, Jadlog, e outras) usado por grandes e-commerces.

Enquanto o Melhor Envio não estiver conectado, o site roda em **modo simulado**: usa uma tabela de frete fixo por região como reserva (não trava o checkout, só não mostra várias opções de transportadora).

**Atenção:** o Melhor Envio exige um login OAuth2 (parecido com "Entrar com Google") — não é mais um token fixo simples. São dois passos: primeiro configurar as credenciais no `.env`, depois **autorizar de fato** clicando num botão no painel admin.

### Passo a passo para ativar o frete real

1. Crie uma conta em **https://www.melhorenvio.com.br**
2. Vá em **"Integrações"** → **"Área Dev."** → **"Cadastrar aplicativo"**
3. Preencha o formulário:
   - **Site da plataforma / URL do ambiente de testes:** o endereço do seu backend publicado (ex: `https://ferraz-backend.onrender.com`)
   - **URL de redirecionamento após autorização (callback):** o mesmo endereço + `/api/frete/melhor-envio/callback` (ex: `https://ferraz-backend.onrender.com/api/frete/melhor-envio/callback`)
   - Desative a opção **"Permitir que o usuário altere as configurações de transportadora"** (é só pra uso interno de vocês, não pra outras lojas)
4. Depois de cadastrar, copie o **Client ID** e o **Secret** mostrados
5. No `.env` do backend, preencha:
   ```
   MELHOR_ENVIO_CLIENT_ID=o_client_id_copiado
   MELHOR_ENVIO_CLIENT_SECRET=o_secret_copiado
   MELHOR_ENVIO_CEP_ORIGEM=00000000
   ```
   (`MELHOR_ENVIO_CEP_ORIGEM` é o CEP de onde a loja despacha os pedidos — só números, sem hífen. E confirme que `BACKEND_URL` também está preenchido no `.env`, com o mesmo endereço usado no callback)
6. Reinicie o backend
7. Entre no **painel admin** → aba **"Frete"** → clique em **"Conectar com Melhor Envio"** — isso abre a tela de login/autorização deles; depois de autorizar, você volta pro painel já conectado

A partir daí, o checkout passa a mostrar cotações reais automaticamente. O token de acesso expira a cada 30 dias, mas o sistema **renova sozinho** (usando o token de renovação, válido por 45 dias) — não precisa refazer esse processo periodicamente, só na primeira vez.

### Peso e dimensões dos produtos

O cálculo de frete real precisa saber o peso e o tamanho de cada peça (embalada). Isso já vem com valores padrão razoáveis (0,3kg, 5×25×35cm — uma peça de roupa dobrada), mas você pode ajustar produto por produto na tela de edição do admin, na seção "Peso e dimensões" — quanto mais preciso, mais exato fica o valor do frete cobrado.

### Pedidos de atacado

Pedidos de **atacado** continuam sem frete fixo pelo site (aparece R$ 0,00) — o volume varia demais pra cotação automática fazer sentido, então o envio é combinado diretamente com o cliente fora do checkout, como já era antes.

---

## 9. Personalização visual

Toda a paleta de cores, tipografia e espaçamentos ficam centralizados em `frontend/css/style.css` (variáveis CSS no topo do arquivo) e `frontend/admin/css/admin.css`. Para trocar a cor principal, por exemplo, basta alterar `--cor-primaria` em um único lugar.

---

## 10. Rodando no Windows com XAMPP (atenção especial aqui)

Se você usa XAMPP, o MySQL já vem embutido — não precisa instalar nada além do Node.js. Só um detalhe importante:

**Não importe o `database.sql` usando o PowerShell com `Get-Content | mysql` ou `<`.** O PowerShell reprocessa o texto do arquivo como string .NET antes de repassar pro MySQL, e isso corrompe acentos (você vai ver coisas como `Cal??as` em vez de `Calças`). Use um destes dois métodos em vez disso:

**Opção A — phpMyAdmin (recomendado, mais simples):**
1. Ligue o MySQL no XAMPP Control Panel
2. Abra `http://localhost/phpmyadmin`
3. Aba **"Importar"** (não precisa estar dentro de nenhum banco específico)
4. Escolha o arquivo `database.sql`
5. Confira se o campo **"Conjunto de caracteres do arquivo"** está como `utf8mb4` (ou `utf-8`)
6. Clique em **Executar**

**Opção B — usar `cmd.exe` em vez do PowerShell** (o `cmd` faz a redireção de arquivo sem reprocessar o texto):
```powershell
cmd /c "C:\xampp\mysql\bin\mysql.exe -u root database.sql < database.sql"
```

Se você já importou pelo caminho errado e os textos já estão corrompidos no banco, apague o banco e importe de novo por um dos métodos acima:
```sql
DROP DATABASE ferraz_ecommerce;
```
(pode rodar esse comando na aba "SQL" do phpMyAdmin)

---

## 11. Colocando o site no ar de graça (sem cartão de crédito)

Vamos usar 3 serviços gratuitos, cada um cuidando de uma parte:

| O quê | Onde |
|---|---|
| Banco de dados MySQL | **Aiven** (grátis para sempre, sem cartão) |
| Backend (API Node.js) | **Render** — Web Service (grátis, sem cartão) |
| Frontend (loja + admin) | **Render** — Static Site (grátis, sem cartão) |

> **Limitação importante:** no plano grátis do Render, o backend "dorme" depois de 15 minutos sem uso, e demora de 30 a 60 segundos pra acordar na próxima visita. Para uma loja pequena começando, é um ótimo ponto de partida — quando o movimento crescer, dá pra migrar pro plano pago (a partir de uns R$35/mês) sem precisar mudar o código.
>
> Outra limitação: fotos de produtos enviadas pelo painel admin **não ficam salvas permanentemente** nesse plano grátis (o servidor "esquece" arquivos ao reiniciar). Funciona para testar, mas se isso for um problema no dia a dia, me avise depois que a loja estiver no ar — dá pra resolver conectando um serviço de imagens (ex: Cloudinary, também com plano grátis).

### Passo 1 — Colocar o código no GitHub

O Render puxa o código direto do GitHub, então precisamos subir os arquivos lá (sem precisar usar comandos de terminal — dá pra fazer tudo pelo site).

1. Crie uma conta grátis em **https://github.com** (se ainda não tiver)
2. Clique no `+` no canto superior direito → **"New repository"**
3. Dê o nome `ferraz-ecommerce`, deixe como **Public** ou **Private** (tanto faz), e clique **"Create repository"**
4. Na página do repositório recém-criado, clique no link **"uploading an existing file"**
5. Arraste **a pasta inteira** `ferraz` (ou os arquivos de dentro dela) pra essa área
6. Role para baixo e clique **"Commit changes"**

> Isso sobe tudo, incluindo o `backend` e o `frontend`, como pastas dentro do mesmo repositório — é assim que o Render vai enxergar.

### Passo 2 — Criar o banco de dados no Aiven

1. Crie uma conta grátis em **https://aiven.io**
2. Clique em **"Create service"** → escolha **MySQL**
3. Selecione o plano **Free** (1GB, grátis para sempre)
4. Escolha uma região (qualquer uma, de preferência próxima do Brasil, ex: São Paulo se disponível, ou EUA)
5. Dê um nome ao serviço (ex: `ferraz-db`) e clique em **Create**
6. Aguarde uns 2-5 minutos até o status ficar **"Running"**
7. Na página do serviço, você vai ver os dados de conexão: **Host**, **Port**, **User**, **Password**. Anote todos.

**Importar o banco de dados:** o Aiven não tem uma tela tipo phpMyAdmin embutida, então vamos usar um programa gratuito chamado **HeidiSQL** (Windows) pra importar o `database.sql`:

1. Baixe e instale o HeidiSQL: **https://www.heidisql.com**
2. Abra o HeidiSQL → **Nova conexão**
3. Tipo de rede: **MySQL (TCP/IP)**
4. Preencha Host, usuário, senha e porta com os dados que o Aiven te deu
5. Antes de conectar, vá na aba **SSL** da mesma tela e marque **"Requer SSL"** (o Aiven exige conexão criptografada)
6. Clique em **Abrir**
7. Depois de conectado, clique com o botão direito na conexão → **"Carregar arquivo SQL..."** → selecione o `database.sql` → execute (ícone de "play" ou `Ctrl+Enter`)

Isso cria o banco `ferraz_ecommerce` com todas as tabelas e dados de exemplo dentro do Aiven.

### Passo 3 — Publicar o backend no Render

1. Crie uma conta grátis em **https://render.com** (dá pra entrar direto com sua conta do GitHub)
2. No painel, clique **"New +"** → **"Web Service"**
3. Conecte sua conta do GitHub e selecione o repositório `ferraz-ecommerce`
4. Preencha:
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. Antes de criar, adicione as **variáveis de ambiente** (seção "Environment Variables") — são os mesmos campos do seu `.env`, com os dados do Aiven:
   ```
   DB_HOST       = (host que o Aiven te deu)
   DB_PORT       = (porta que o Aiven te deu)
   DB_USER       = (usuário que o Aiven te deu)
   DB_PASSWORD   = (senha que o Aiven te deu)
   DB_NAME       = ferraz_ecommerce
   DB_SSL        = true
   JWT_SECRET    = (invente uma frase longa e aleatória)
   JWT_EXPIRES_IN= 8h
   FRONTEND_URL  = *
   MP_ACCESS_TOKEN = (deixe em branco por enquanto se ainda não tiver o token do Mercado Pago — veja a seção 7)
   MP_PUBLIC_KEY   = (idem — a chave pública, também vem da seção 7)
   BACKEND_URL   = https://ferraz-backend.onrender.com (troque pelo nome real do serviço, você já vai saber depois do passo 3)
   SMTP_HOST     = smtp.gmail.com (ou deixe em branco pro modo simulado — veja a seção 7.1)
   SMTP_PORT     = 587
   SMTP_USER     = (seu e-mail, se for usar Gmail)
   SMTP_PASS     = (a senha de app do Gmail, se for usar)
   SMTP_FROM     = "FERRAZ <seuemail@gmail.com>"
   MELHOR_ENVIO_CLIENT_ID     = (deixe em branco se ainda não tiver — veja a seção 8)
   MELHOR_ENVIO_CLIENT_SECRET = (idem)
   MELHOR_ENVIO_CEP_ORIGEM    = (o CEP de onde a loja despacha os pedidos)
   ```
   (deixe `FRONTEND_URL=*` por enquanto — vamos ajustar depois de publicar o frontend)
6. Clique **"Create Web Service"**

O Render vai instalar as dependências e ligar o servidor. Espere até aparecer **"Live"** no topo. Anote a URL que ele te dá, algo como `https://ferraz-backend.onrender.com`.

Teste abrindo no navegador: `https://ferraz-backend.onrender.com/api/health` — deve responder `{"status":"ok",...}`.

### Passo 4 — Apontar o frontend para o backend publicado

Antes de publicar o frontend, edite o arquivo **`frontend/js/api.js`** e troque a linha:
```js
const BACKEND_ORIGIN = 'http://localhost:5000';
```
pela URL real do seu backend no Render (sem barra `/` no final):
```js
const BACKEND_ORIGIN = 'https://ferraz-backend.onrender.com';
```
Suba esse arquivo atualizado no GitHub (na página do arquivo, clique no lápis "Edit" e depois "Commit changes" — não precisa reenviar tudo de novo).

### Passo 5 — Publicar o frontend no Render

1. No painel do Render, clique **"New +"** → **"Static Site"**
2. Selecione o mesmo repositório `ferraz-ecommerce`
3. Preencha:
   - **Root Directory:** `frontend`
   - **Build Command:** (deixe em branco)
   - **Publish Directory:** `.`
4. Clique **"Create Static Site"**

Espere ficar **"Live"** e anote essa URL também, algo como `https://ferraz-loja.onrender.com`.

**Sobre a página 404 personalizada:** localmente, o `npx serve` já mostra o `404.html` automaticamente pra qualquer endereço que não existir. No Render, depois do site publicado, vá em **"Redirects/Rewrites"** (na configuração do Static Site) e adicione uma regra: origem `/*`, destino `/404.html`, tipo **"Rewrite"**, com prioridade mais baixa que as demais — isso garante que qualquer link quebrado caia na página 404 da marca em vez da tela genérica do navegador.

### Passo 6 — Fechar o CORS (última configuração)

Volte no serviço do **backend** no Render → aba **"Environment"** → edite a variável `FRONTEND_URL` e troque o `*` pela URL real do frontend, ex:
```
FRONTEND_URL = https://ferraz-loja.onrender.com
```
Salve — o Render reinicia o backend automaticamente.

### Pronto! Testando

- **Loja:** `https://ferraz-loja.onrender.com/index.html`
- **Admin:** `https://ferraz-loja.onrender.com/admin/login.html` (mesmo login: `admin@ferraz.com` / `ferraz123`)

Se a primeira visita demorar uns 30-60 segundos pra carregar, é normal — é o backend "acordando" do modo de espera do plano grátis. As visitas seguintes ficam rápidas.

---

## 12. Próximos passos sugeridos (fora do escopo deste pacote)

- Tela de "esqueci minha senha" (tanto do admin quanto do cliente)
- Cálculo de frete real via API dos Correios (hoje é frete fixo por região)
- Paginação na listagem de produtos/pedidos quando o catálogo crescer
- Domínio próprio (ex: `ferraz.com.br`) apontado para o Render
- Fotos de produto em um serviço de armazenamento persistente (ex: Cloudinary) — necessário se for hospedar no plano grátis do Render, que apaga arquivos enviados ao reiniciar
- Endereços múltiplos por cliente (hoje cada conta tem um único endereço padrão salvo)

