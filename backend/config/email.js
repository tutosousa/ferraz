// Configuração de envio de e-mails (verificação de cadastro e login em duas
// etapas / 2FA).
//
// Existem DOIS jeitos de enviar, e o sistema escolhe automaticamente:
//
// 1) API do Brevo (recomendado, principalmente se o backend estiver
//    publicado no Render): usa uma chamada HTTPS normal, então não é
//    bloqueada pelas restrições de porta SMTP que hospedagens gratuitas
//    (como o Render) aplicam por padrão.
//      BREVO_API_KEY=a_chave_de_api_do_brevo (não é a chave SMTP! é outra,
//      gerada na aba "Chaves API e MCP" dentro de "Integrações" no painel
//      do Brevo)
//
// 2) SMTP tradicional (funciona bem rodando local, mas pode ser bloqueado
//    em algumas hospedagens gratuitas):
//      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// Se nenhum dos dois estiver configurado, o sistema roda em MODO SIMULADO:
// o código de verificação aparece na tela (e no log do servidor) em vez de
// ser enviado por e-mail de verdade — ótimo para testar localmente sem
// precisar configurar nada.

const nodemailer = require('nodemailer');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_ATIVO = Boolean(BREVO_API_KEY);

const SMTP_ATIVO = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

const EMAIL_ATIVO = BREVO_ATIVO || SMTP_ATIVO;

const transporter = SMTP_ATIVO
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

// Extrai nome e e-mail de "SMTP_FROM" no formato 'FERRAZ <email@dominio.com>'
function extrairRemetente() {
  const bruto = process.env.SMTP_FROM || process.env.SMTP_USER || 'contato@ferraz.com.br';
  const match = bruto.match(/^(.*)<(.+)>$/);
  if (match) {
    return { name: match[1].trim() || 'FERRAZ', email: match[2].trim() };
  }
  return { name: 'FERRAZ', email: bruto.trim() };
}

// Testa a conexão assim que o backend sobe, pra avisar de cara se algo
// estiver configurado errado — em vez de só descobrir isso quando alguém
// tentar se cadastrar.
async function testarConexaoEmail() {
  if (BREVO_ATIVO) {
    console.log('✅ Envio de e-mail via API do Brevo está ativo.');
    return;
  }
  if (!SMTP_ATIVO) return;
  try {
    await transporter.verify();
    console.log(`✅ Conectado ao servidor de e-mail com sucesso (${process.env.SMTP_USER})`);
  } catch (err) {
    console.error(`\n❌ Falha ao conectar ao servidor de e-mail via SMTP: ${err.message}`);
    console.error('   Se estiver rodando no Render (ou outra hospedagem gratuita), isso é');
    console.error('   esperado: eles bloqueiam as portas de SMTP no plano grátis. Use a API');
    console.error('   do Brevo em vez disso (variável BREVO_API_KEY) — veja o .env.example.\n');
  }
}

async function enviarViaBrevoAPI(destinatario, assunto, corpo) {
  const remetente = extrairRemetente();

  const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: remetente,
      to: [{ email: destinatario }],
      subject: assunto,
      textContent: corpo,
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`API do Brevo recusou o envio (status ${resposta.status}): ${detalhe}`);
  }

  return resposta.json();
}

async function enviarViaSmtp(destinatario, assunto, corpo) {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destinatario,
    subject: assunto,
    text: corpo,
  });

  // O servidor pode "aceitar" a chamada sem lançar erro, mas ainda assim
  // recusar o destinatário (info.rejected não fica vazio nesse caso).
  if (info.rejected && info.rejected.length > 0) {
    throw new Error(`O servidor de e-mail recusou o envio para ${info.rejected.join(', ')}.`);
  }
  return info;
}

async function enviarEmailCodigo(destinatario, codigo, tipo) {
  const assunto = tipo === 'cadastro'
    ? 'Confirme seu cadastro na FERRAZ'
    : 'Seu código de acesso FERRAZ';

  const corpo = tipo === 'cadastro'
    ? `Seu código de confirmação de cadastro é: ${codigo}\n\nEle expira em 10 minutos.`
    : `Seu código de acesso é: ${codigo}\n\nEle expira em 10 minutos. Se não foi você tentando entrar, ignore este e-mail.`;

  if (!EMAIL_ATIVO) {
    // Modo simulado: apenas registra no log do servidor.
    console.log(`\n📧 [MODO SIMULADO] E-mail para ${destinatario}: ${assunto}`);
    console.log(`   Código: ${codigo}\n`);
    return { simulado: true };
  }

  try {
    if (BREVO_ATIVO) {
      const resultado = await enviarViaBrevoAPI(destinatario, assunto, corpo);
      console.log(`\n✅ E-mail enviado via API do Brevo para ${destinatario} (id: ${resultado.messageId})\n`);
    } else {
      const info = await enviarViaSmtp(destinatario, assunto, corpo);
      console.log(`\n✅ E-mail enviado via SMTP para ${destinatario} (id: ${info.messageId})\n`);
    }
    return { simulado: false };
  } catch (err) {
    console.error(`\n❌ Falha ao enviar e-mail para ${destinatario}: ${err.message}\n`);
    throw err;
  }
}

module.exports = { enviarEmailCodigo, testarConexaoEmail, EMAIL_ATIVO };
