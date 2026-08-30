// Serviço de cálculo de frete: frete fixo por região.
//
// (Nota: uma integração com o Melhor Envio para frete real com múltiplas
// transportadoras já foi tentada, mas ficou travada num erro específico da
// conta/aplicativo do lado deles [invalid_client persistente, mesmo com
// tudo configurado corretamente], sem resposta do suporte. Foi removida
// por enquanto — pode ser reimplementada no futuro se resolverem isso.)

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

function calcularFretePorRegiao(estadoDestino) {
  const estado = (estadoDestino || '').toUpperCase();
  const valor = estado === 'PE' ? FRETE_POR_REGIAO.PE : FRETE_POR_REGIAO[REGIAO_POR_ESTADO[estado]] || 35.0;
  return [
    {
      id: 'padrao',
      transportadora: 'Envio padrão',
      servico: 'Frete fixo por região',
      preco: valor,
      prazo_dias: 7,
    },
  ];
}

// Mantém a mesma "forma" de resposta que o resto do código já espera
// ({ ativo, opcoes, aviso? }), pra não precisar mexer em mais nada.
async function obterOpcoesFrete(cepDestino, estadoDestino, itens) {
  return { ativo: false, opcoes: calcularFretePorRegiao(estadoDestino) };
}

module.exports = { obterOpcoesFrete };
