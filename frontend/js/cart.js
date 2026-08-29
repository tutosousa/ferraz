// Lógica do carrinho de compras.
// O site tem DOIS carrinhos independentes, guardados no localStorage do
// navegador do cliente:
//   - "varejo": carrinho normal da loja (index.html, produto.html)
//   - "atacado": carrinho da página de atacado (atacado.html), onde todo
//     item já usa o preço de atacado do produto, e o pedido mínimo é de
//     50 peças no total (validado no checkout).
// Todas as funções abaixo recebem um parâmetro opcional `modo` ('varejo'
// por padrão) para operar no carrinho certo.
//
// Cada item do carrinho tem uma "chave" única que combina produto + tamanho
// + cor — assim, o mesmo produto em tamanhos ou cores diferentes vira
// linhas separadas no carrinho, em vez de se misturar.

const CARRINHO_STORAGE_KEYS = {
  varejo: 'ferraz_carrinho',
  atacado: 'ferraz_carrinho_atacado',
};

function gerarChaveItem(produtoId, tamanho, cor) {
  return `${produtoId}|${tamanho || ''}|${cor || ''}`;
}

function obterCarrinho(modo = 'varejo') {
  try {
    const dados = localStorage.getItem(CARRINHO_STORAGE_KEYS[modo]);
    return dados ? JSON.parse(dados) : [];
  } catch (e) {
    return [];
  }
}

function salvarCarrinho(itens, modo = 'varejo') {
  localStorage.setItem(CARRINHO_STORAGE_KEYS[modo], JSON.stringify(itens));
  atualizarContadorCarrinho(modo);
}

// `variacao` é opcional: { tamanho, cor }
function adicionarAoCarrinho(produto, quantidade, modo = 'varejo', variacao = {}) {
  const tamanho = variacao.tamanho || null;
  const cor = variacao.cor || null;
  const chave = gerarChaveItem(produto.id, tamanho, cor);

  const carrinho = obterCarrinho(modo);
  const existente = carrinho.find((item) => item.chave === chave);

  if (existente) {
    existente.quantidade += quantidade;
  } else {
    carrinho.push({
      chave,
      produto_id: produto.id,
      nome: produto.nome,
      tamanho,
      cor,
      preco_varejo: Number(produto.preco_varejo),
      preco_atacado: produto.preco_atacado ? Number(produto.preco_atacado) : null,
      quantidade_minima_atacado: produto.quantidade_minima_atacado || 50,
      imagem_url: produto.imagem_url,
      quantidade,
    });
  }

  salvarCarrinho(carrinho, modo);
}

function atualizarQuantidade(chave, novaQuantidade, modo = 'varejo') {
  let carrinho = obterCarrinho(modo);
  if (novaQuantidade <= 0) {
    carrinho = carrinho.filter((item) => item.chave !== chave);
  } else {
    const item = carrinho.find((i) => i.chave === chave);
    if (item) item.quantidade = novaQuantidade;
  }
  salvarCarrinho(carrinho, modo);
  return carrinho;
}

function removerDoCarrinho(chave, modo = 'varejo') {
  const carrinho = obterCarrinho(modo).filter((item) => item.chave !== chave);
  salvarCarrinho(carrinho, modo);
  return carrinho;
}

function limparCarrinho(modo = 'varejo') {
  salvarCarrinho([], modo);
}

// Calcula o preço unitário aplicável e o subtotal do item.
// - No varejo: preço de atacado só entra se ESSE item sozinho atingir a
//   quantidade mínima do produto (ex: 50 unidades daquela peça específica).
// - No atacado: o preço de atacado do produto é usado sempre, direto,
//   independente da quantidade daquele item (o mínimo é do PEDIDO todo).
function calcularItem(item, modo = 'varejo') {
  const ehAtacado =
    modo === 'atacado'
      ? Boolean(item.preco_atacado)
      : item.preco_atacado && item.quantidade >= item.quantidade_minima_atacado;
  const precoUnitario = ehAtacado ? item.preco_atacado : item.preco_varejo;
  return {
    ...item,
    ehAtacado,
    precoUnitario,
    subtotal: precoUnitario * item.quantidade,
  };
}

function calcularSubtotalCarrinho(modo = 'varejo') {
  return obterCarrinho(modo)
    .map((item) => calcularItem(item, modo))
    .reduce((soma, item) => soma + item.subtotal, 0);
}

function contarItensCarrinho(modo = 'varejo') {
  return obterCarrinho(modo).reduce((soma, item) => soma + item.quantidade, 0);
}

// Atualiza o contador visível no ícone do carrinho no cabeçalho (se existir na página).
// Nas páginas de atacado, o contador mostra o carrinho de atacado; nas
// demais, o de varejo — cada página já sabe qual modo usar.
function atualizarContadorCarrinho(modo = 'varejo') {
  const contadorEl = document.getElementById('carrinho-contador');
  if (contadorEl) {
    contadorEl.textContent = contarItensCarrinho(modo);
  }
}

document.addEventListener('DOMContentLoaded', () => atualizarContadorCarrinho(
  document.body.dataset.modoCarrinho === 'atacado' ? 'atacado' : 'varejo'
));
