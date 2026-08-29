// Serviço de cotação de frete: consulta o Melhor Envio (Correios, Jadlog,
// etc) para trazer várias opções reais de envio, com preço e prazo de cada
// transportadora — exatamente como aparece nos grandes e-commerces.

const {
  MELHOR_ENVIO_ATIVO,
  MELHOR_ENVIO_BASE_URL,
  MELHOR_ENVIO_TOKEN,
  MELHOR_ENVIO_CEP_ORIGEM,
} = require('../config/melhorEnvio');

// ---------- Modo simulado (frete fixo por região) ----------
// Usado como reserva enquanto o Melhor Envio não está configurado, ou se a
// consulta a ele falhar por algum motivo (ex: fora do ar).
const FRETE_POR_REGIAO = {
  PE: 15.0,
  Norte: 45.0,
  Nordeste: 25.0,
  'Centro-Oeste': 35.0,
  Sudeste: 30.0,
  Sul: 40.0,
};
const REGIAO_POR_ESTADO = {
  AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste',
  PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', RS: 'Sul', SC: 'Sul',
};

function cotacaoSimulada(estadoDestino) {
  const estado = (estadoDestino || '').toUpperCase();
  const valor = estado === 'PE' ? FRETE_POR_REGIAO.PE : FRETE_POR_REGIAO[REGIAO_POR_ESTADO[estado]] || 35.0;
  return [
    {
      id: 'simulado-padrao',
      transportadora: 'Envio padrão',
      servico: 'Estimativa (frete real ainda não configurado pela loja)',
      preco: valor,
      prazo_dias: 7,
    },
  ];
}

// ---------- Consulta real ao Melhor Envio ----------

// Soma o peso e as dimensões dos itens do carrinho num único "pacote"
// simplificado (empilha as alturas, usa a maior largura/comprimento).
function calcularPacote(itens) {
  let peso = 0;
  let altura = 0;
  let largura = 0;
  let comprimento = 0;

  itens.forEach((item) => {
    peso += Number(item.peso_kg || 0.3) * item.quantidade;
    altura += Number(item.altura_cm || 5) * item.quantidade;
    largura = Math.max(largura, Number(item.largura_cm || 25));
    comprimento = Math.max(comprimento, Number(item.comprimento_cm || 35));
  });

  return {
    weight: Math.max(0.1, Number(peso.toFixed(3))),
    height: Math.max(2, Math.min(altura, 100)), // Correios limita a 100cm
    width: Math.max(11, largura),
    length: Math.max(16, comprimento),
  };
}

async function cotarFreteReal(cepDestino, itens) {
  const pacote = calcularPacote(itens);

  const resposta = await fetch(`${MELHOR_ENVIO_BASE_URL}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'FERRAZ E-commerce (contato@ferraz.com.br)',
    },
    body: JSON.stringify({
      from: { postal_code: MELHOR_ENVIO_CEP_ORIGEM },
      to: { postal_code: String(cepDestino).replace(/\D/g, '') },
      package: pacote,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Melhor Envio respondeu com erro (status ${resposta.status})`);
  }

  const dados = await resposta.json();

  // A API retorna uma opção por transportadora/serviço; filtramos as que
  // deram erro (ex: fora da área de cobertura) e ordenamos da mais barata.
  return dados
    .filter((opcao) => !opcao.error && opcao.price)
    .map((opcao) => ({
      id: String(opcao.id),
      transportadora: opcao.company?.name || 'Transportadora',
      servico: opcao.name,
      preco: Number(opcao.price),
      prazo_dias: opcao.delivery_time,
    }))
    .sort((a, b) => a.preco - b.preco);
}

// Função principal: tenta o Melhor Envio; se não estiver configurado ou a
// consulta falhar, cai automaticamente pro modo simulado.
async function obterOpcoesFrete(cepDestino, estadoDestino, itens) {
  if (!MELHOR_ENVIO_ATIVO) {
    return { ativo: false, opcoes: cotacaoSimulada(estadoDestino) };
  }

  try {
    const opcoes = await cotarFreteReal(cepDestino, itens);
    if (opcoes.length === 0) {
      // Melhor Envio respondeu mas nenhuma transportadora atende esse CEP
      return { ativo: true, opcoes: cotacaoSimulada(estadoDestino), aviso: 'Nenhuma transportadora disponível para este CEP no momento — usando estimativa.' };
    }
    return { ativo: true, opcoes };
  } catch (err) {
    console.error('Erro ao consultar frete no Melhor Envio:', err.message);
    return { ativo: true, opcoes: cotacaoSimulada(estadoDestino), aviso: 'Não foi possível consultar o frete em tempo real — usando estimativa.' };
  }
}

module.exports = { obterOpcoesFrete, calcularPacote, MELHOR_ENVIO_ATIVO };
