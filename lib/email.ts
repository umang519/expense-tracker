import nodemailer from "nodemailer";

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"Expense Tracker" <${process.env.SMTP_USERNAME}>`,
    to,
    subject,
    html,
    text,
    headers: {
      "X-Priority": "1",
      "X-Mailer": "Expense Tracker App",
    },
  });
}

export function otpEmail(otp: string, purpose: string): { html: string; text: string } {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#111">Expense Tracker</h2>
      <p style="margin:0 0 24px;color:#555;font-size:15px">${purpose}</p>
      <div style="background:#f5f3ff;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#7c3aed">${otp}</span>
      </div>
      <p style="margin:0 0 8px;color:#888;font-size:13px">This code expires in 15 minutes.</p>
      <p style="margin:0;color:#888;font-size:13px">If you did not request this, you can safely ignore this email. No action is needed.</p>
    </div>
  `;
  const text = `Expense Tracker\n\n${purpose}\n\nYour verification code: ${otp}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, ignore this email.`;
  return { html, text };
}
