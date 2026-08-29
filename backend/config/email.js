// Configuração de envio de e-mails (verificação de cadastro e login em duas
// etapas / 2FA).
//
// Para ativar o envio real de e-mails, preencha no .env do backend:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// O jeito mais simples e gratuito pra começar é usar uma conta do Gmail:
//   1. Crie (ou use) uma conta do Gmail para a loja.
//   2. Ative a "verificação em duas etapas" na conta Google.
//   3. Gere uma "Senha de app" em https://myaccount.google.com/apppasswords
//   4. Use:
//        SMTP_HOST=smtp.gmail.com
//        SMTP_PORT=587
//        SMTP_USER=seuemail@gmail.com
//        SMTP_PASS=a senha de app gerada (16 letras, sem espaços)
//        SMTP_FROM="FERRAZ <seuemail@gmail.com>"
//
// Enquanto o SMTP não estiver configurado, o sistema roda em MODO SIMULADO:
// o código de verificação aparece na tela (e no log do servidor) em vez de
// ser enviado por e-mail de verdade — ótimo para testar localmente sem
// precisar configurar nada.

const nodemailer = require('nodemailer');

const EMAIL_ATIVO = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

const transporter = EMAIL_ATIVO
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

// Testa a conexão/autenticação com o servidor SMTP assim que o backend
// sobe, pra avisar de cara se a senha de app ou o host estiverem errados —
// em vez de só descobrir isso quando alguém tentar se cadastrar.
async function testarConexaoEmail() {
  if (!EMAIL_ATIVO) return;
  try {
    await transporter.verify();
    console.log(`✅ Conectado ao servidor de e-mail com sucesso (${process.env.SMTP_USER})`);
  } catch (err) {
    console.error(`\n❌ Falha ao conectar ao servidor de e-mail: ${err.message}`);
    console.error('   Verifique SMTP_HOST, SMTP_USER e SMTP_PASS no .env (a senha de app do Gmail).\n');
  }
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

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destinatario,
    subject: assunto,
    text: corpo,
  });

  // O Gmail pode "aceitar" a chamada sem lançar erro, mas ainda assim
  // recusar o destinatário (info.rejected não fica vazio nesse caso).
  // Sem checar isso, o e-mail "some" silenciosamente — então avisamos bem
  // claro no log do servidor o que realmente aconteceu.
  if (info.rejected && info.rejected.length > 0) {
    console.error(`\n❌ E-mail REJEITADO pelo servidor SMTP para: ${info.rejected.join(', ')}`);
    throw new Error(`O servidor de e-mail recusou o envio para ${info.rejected.join(', ')}.`);
  }

  console.log(`\n✅ E-mail enviado para ${destinatario} (id: ${info.messageId})\n`);
  return { simulado: false };
}

module.exports = { enviarEmailCodigo, testarConexaoEmail, EMAIL_ATIVO };
