// Funções compartilhadas do painel administrativo:
// autenticação (token JWT salvo no localStorage), chamadas autenticadas
// à API, e montagem do menu lateral.

const ADMIN_TOKEN_KEY = 'ferraz_admin_token';
const ADMIN_INFO_KEY = 'ferraz_admin_info';

function obterTokenAdmin() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function salvarSessaoAdmin(token, admin) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_INFO_KEY, JSON.stringify(admin));
}

function obterAdminLogado() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_INFO_KEY));
  } catch (e) {
    return null;
  }
}

function logoutAdmin() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_INFO_KEY);
  window.location.href = 'login.html';
}

// Redireciona para o login se não houver token. Chame no topo de cada
// página protegida do painel (dashboard, produtos, pedidos, financeiro).
function exigirLoginAdmin() {
  if (!obterTokenAdmin()) {
    window.location.href = 'login.html';
  }
}

// Wrapper de fetch que já inclui o header Authorization e trata 401
// (token expirado ou inválido) redirecionando para o login novamente.
async function apiFetchAdmin(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      Authorization: `Bearer ${obterTokenAdmin()}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    logoutAdmin();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    /* sem corpo */
  }

  if (!response.ok) {
    throw new Error((data && data.error) || 'Erro ao comunicar com o servidor.');
  }

  return data;
}

// Monta o menu lateral e marca o item ativo com base no nome do arquivo atual.
// Também injeta a barra superior mobile (com botão hambúrguer) que abre o
// menu como uma gaveta lateral em telas pequenas.
function montarSidebarAdmin(paginaAtiva) {
  const admin = obterAdminLogado();
  const itens = [
    { href: 'dashboard.html', label: 'Visão geral', chave: 'dashboard' },
    { href: 'produtos.html', label: 'Produtos', chave: 'produtos' },
    { href: 'categorias.html', label: 'Categorias', chave: 'categorias' },
    { href: 'pedidos.html', label: 'Pedidos', chave: 'pedidos' },
    { href: 'financeiro.html', label: 'Financeiro', chave: 'financeiro' },
  ];

  const nav = document.getElementById('admin-nav');
  if (!nav) return;

  nav.innerHTML = itens
    .map(
      (item) => `
      <li>
        <a href="${item.href}" class="${item.chave === paginaAtiva ? 'ativo' : ''}">${item.label}</a>
      </li>
    `
    )
    .join('');

  const nomeEl = document.getElementById('admin-nome');
  if (nomeEl && admin) nomeEl.textContent = admin.nome;

  const btnSair = document.getElementById('btn-sair');
  if (btnSair) btnSair.addEventListener('click', logoutAdmin);

  injetarMenuMobileAdmin();
}

// Cria (se ainda não existir) a barra superior mobile e o fundo escurecido,
// e liga o botão de abrir/fechar o menu lateral no celular.
function injetarMenuMobileAdmin() {
  const shell = document.querySelector('.admin-shell');
  const sidebar = document.querySelector('.admin-sidebar');
  if (!shell || !sidebar || document.querySelector('.admin-topbar-mobile')) return;

  const topbar = document.createElement('div');
  topbar.className = 'admin-topbar-mobile';
  topbar.innerHTML = `
    <div class="admin-topbar-mobile__logo">
      <img src="../assets/logo.png" alt="Logo FERRAZ">
      <span>FERRAZ Admin</span>
    </div>
    <button type="button" class="admin-menu-toggle" aria-label="Abrir menu">☰</button>
  `;
  shell.insertBefore(topbar, shell.firstChild);

  const fundo = document.createElement('div');
  fundo.className = 'admin-sidebar-fundo';
  shell.appendChild(fundo);

  function abrirMenu() {
    sidebar.classList.add('aberta');
    fundo.classList.add('visivel');
  }
  function fecharMenu() {
    sidebar.classList.remove('aberta');
    fundo.classList.remove('visivel');
  }

  topbar.querySelector('.admin-menu-toggle').addEventListener('click', abrirMenu);
  fundo.addEventListener('click', fecharMenu);
  sidebar.querySelectorAll('a').forEach((a) => a.addEventListener('click', fecharMenu));
}

function classeBadgeStatus(status) {
  return `badge badge-${status}`;
}
