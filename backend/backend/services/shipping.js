// Serviço de cálculo de frete.
//
// Se o Melhor Envio estiver conectado (ver config/melhorEnvio.js e
// services/melhorEnvioAuth.js), consulta o preço e prazo reais de várias
// transportadoras. Caso contrário, cai no modo reserva: frete grátis (o
// mesmo comportamento que a loja já usava antes desta integração).

const { MELHOR_ENVIO_CONFIGURADO, CEP_ORIGEM, API_BASE_URL } = require('../config/melhorEnvio');
const { obterTokenValido } = require('./melhorEnvioAuth');

async function cotarFreteReal(cepDestino, itens) {
  const token = await obterTokenValido();
  if (!token) return null; // ainda não autorizado pelo admin

  const produtosParaCotacao = (itens && itens.length > 0)
    ? itens.map((item) => ({
        id: String(item.id || item.produto_id),
        width: item.largura_cm || 25,
        height: item.altura_cm || 5,
        length: item.comprimento_cm || 35,
        weight: item.peso_kg || 0.3,
        insurance_value: Number(item.preco_unitario || item.preco_varejo || 0),
        quantity: item.quantidade || 1,
      }))
    : [{ id: '1', width: 25, height: 5, length: 35, weight: 0.3, insurance_value: 50, quantity: 1 }];

  const resposta = await fetch(`${API_BASE_URL}/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'FERRAZ E-commerce (ferrazcollection@icloud.com)',
    },
    body: JSON.stringify({
      from: { postal_code: CEP_ORIGEM },
      to: { postal_code: String(cepDestino).replace(/\D/g, '') },
      products: produtosParaCotacao,
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Melhor Envio recusou a cotação (status ${resposta.status}): ${detalhe}`);
  }

  const dados = await resposta.json();

  // A API retorna uma opção por transportadora — descartamos as que vieram
  // com erro (ex: fora da área de cobertura daquela transportadora
  // específica) e ordenamos as válidas da mais barata pra mais cara.
  return dados
    .filter((op) => !op.error && op.price)
    .sort((a, b) => Number(a.price) - Number(b.price))
    .map((op) => ({
      id: String(op.id),
      transportadora: op.company?.name || 'Transportadora',
      servico: op.name,
      preco: Number(op.price),
      prazo_dias: op.delivery_time ?? null,
    }));
}

function freteGratis() {
  return {
    ativo: false,
    opcoes: [{ id: 'gratis', transportadora: 'Envio padrão', servico: 'Frete grátis', preco: 0, prazo_dias: 7 }],
  };
}

// Função principal usada pelo resto do sistema: tenta o Melhor Envio real
// se estiver conectado, e cai pro frete grátis em qualquer outro caso
// (não conectado, CEP inválido, erro de rede, etc) — assim o checkout
// nunca trava por causa do frete.
async function obterOpcoesFrete(cepDestino, itens) {
  if (!MELHOR_ENVIO_CONFIGURADO || !cepDestino) {
    return freteGratis();
  }

  try {
    const opcoesReais = await cotarFreteReal(cepDestino, itens);
    if (!opcoesReais || opcoesReais.length === 0) {
      return freteGratis();
    }
    return { ativo: true, opcoes: opcoesReais };
  } catch (err) {
    console.error('Erro ao cotar frete no Melhor Envio, usando frete grátis como reserva:', err.message);
    return freteGratis();
  }
}

module.exports = { obterOpcoesFrete };
