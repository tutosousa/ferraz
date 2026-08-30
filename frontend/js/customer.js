// Funções compartilhadas de autenticação de CLIENTES da loja (compradores),
// separado por completo do login do painel administrativo.

const CLIENTE_TOKEN_KEY = 'ferraz_cliente_token';
const CLIENTE_INFO_KEY = 'ferraz_cliente_info';

function obterTokenCliente() {
  return localStorage.getItem(CLIENTE_TOKEN_KEY);
}

function salvarSessaoCliente(token, cliente) {
  localStorage.setItem(CLIENTE_TOKEN_KEY, token);
  localStorage.setItem(CLIENTE_INFO_KEY, JSON.stringify(cliente));
}

function obterClienteLogado() {
  try {
    return JSON.parse(localStorage.getItem(CLIENTE_INFO_KEY));
  } catch (e) {
    return null;
  }
}

function logoutCliente() {
  localStorage.removeItem(CLIENTE_TOKEN_KEY);
  localStorage.removeItem(CLIENTE_INFO_KEY);
  window.location.href = 'index.html';
}

// Wrapper de fetch que inclui o header Authorization com o token do cliente
// (usado nas telas de perfil e "meus pedidos").
async function apiFetchCliente(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      Authorization: `Bearer ${obterTokenCliente()}`,
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    /* sem corpo */
  }

  if (response.status === 401) {
    logoutCliente();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!response.ok) {
    throw new Error((data && data.error) || 'Erro ao comunicar com o servidor.');
  }

  return data;
}

// Atualiza o link "Entrar" do cabeçalho para "Olá, Fulano" / "Minha conta"
// quando o visitante já estiver logado como cliente. No celular, mostra só
// "Conta" (compacto) em vez do nome completo — nomes longos empurravam o
// botão do carrinho pra fora da linha, quebrando o layout.
function atualizarLinkConta(elementId) {
  const link = document.getElementById(elementId);
  if (!link) return;
  const cliente = obterClienteLogado();
  if (cliente && obterTokenCliente()) {
    const primeiroNome = cliente.nome ? cliente.nome.split(' ')[0] : 'Minha conta';
    link.innerHTML = `
      <span class="conta-texto-completo">Olá, ${escapeHtml(primeiroNome)}</span>
      <span class="conta-texto-compacto">Conta</span>
    `;
    link.href = 'conta.html';
  } else {
    link.textContent = 'Entrar';
    link.href = 'login.html';
  }
}

// Redireciona para o login se o visitante não estiver logado — e, depois
// de logar, traz a pessoa de volta exatamente pra página (e modo, ex:
// atacado) de onde ela veio, em vez de perder o contexto.
function exigirLoginCliente() {
  if (!obterTokenCliente()) {
    const paginaAtual = window.location.pathname.split('/').pop() + window.location.search;
    window.location.href = `login.html?depois=${encodeURIComponent(paginaAtual)}`;
  }
}
