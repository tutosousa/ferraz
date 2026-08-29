// Configuração central de acesso à API do backend.
//
// >>> QUANDO FOR COLOCAR O SITE NO AR (produção), troque as DUAS linhas
// abaixo pelo endereço do seu backend hospedado (ex: no Render), assim:
//   const BACKEND_ORIGIN = 'https://ferraz-backend.onrender.com';
//   const API_BASE_URL = `${BACKEND_ORIGIN}/api`;
//
// Enquanto estiver testando no seu computador, deixe como está (localhost).
const BACKEND_ORIGIN = 'http://localhost:5000';
const API_BASE_URL = `${BACKEND_ORIGIN}/api`;

/**
 * Wrapper simples para chamadas fetch à API.
 * Lança um erro com a mensagem vinda do backend quando a resposta não é OK.
 */
async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    // resposta sem corpo JSON (ex: 204)
  }

  if (!response.ok) {
    const mensagem = (data && data.error) || 'Ocorreu um erro ao comunicar com o servidor.';
    const erro = new Error(mensagem);
    if (data) Object.assign(erro, data); // preserva campos extras (ex: cliente_id)
    throw erro;
  }

  return data;
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// Liga o botão de "mostrar/esconder senha" (ícone de olho) em qualquer
// campo de senha da página que tenha a estrutura .campo-senha. Roda
// automaticamente em toda página que carrega este arquivo, então não
// precisa chamar nada manualmente.
const SVG_OLHO_ABERTO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
const SVG_OLHO_CORTADO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M6.61 6.61C2.9 8.86 1 12 1 12s4 8 11 8a9.26 9.26 0 0 0 5.39-1.61"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function ativarToggleSenha() {
  document.querySelectorAll('.campo-senha__toggle').forEach((botao) => {
    botao.addEventListener('click', () => {
      const input = document.getElementById(botao.dataset.alvo);
      if (!input) return;
      const estaEscondida = input.type === 'password';
      input.type = estaEscondida ? 'text' : 'password';
      botao.innerHTML = estaEscondida ? SVG_OLHO_CORTADO : SVG_OLHO_ABERTO;
      botao.setAttribute('aria-label', estaEscondida ? 'Esconder senha' : 'Mostrar senha');
    });
  });
}
document.addEventListener('DOMContentLoaded', ativarToggleSenha);

// Preenche a lista de categorias no rodapé (presente em todas as páginas).
// Detecta sozinho se a página é a de atacado, pra apontar os links certos.
async function carregarCategoriasRodape() {
  const container = document.getElementById('footer-categorias');
  if (!container) return;

  const ehAtacado = window.location.pathname.includes('atacado');
  const baseUrl = ehAtacado ? 'atacado.html' : 'index.html';

  try {
    const categorias = await apiFetch('/categorias');
    container.innerHTML = `
      <li><a href="${baseUrl}">Ver todas as peças</a></li>
      ${categorias
        .map((cat) => `<li><a href="${baseUrl}?categoria=${encodeURIComponent(cat.slug)}">${escapeHtml(cat.nome)}</a></li>`)
        .join('')}
    `;
  } catch (err) {
    // se a API não responder, deixa só o link genérico que já está no HTML
  }
}

document.addEventListener('DOMContentLoaded', carregarCategoriasRodape);
