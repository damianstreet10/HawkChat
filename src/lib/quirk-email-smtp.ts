import nodemailer from "nodemailer";

export function smtpConfig() {
  const host = process.env.HAWKCHAT_SMTP_HOST?.trim();
  const user = process.env.HAWKCHAT_SMTP_USER?.trim();
  const pass = process.env.HAWKCHAT_SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;

  const port = Number(process.env.HAWKCHAT_SMTP_PORT ?? 587);
  const secure = process.env.HAWKCHAT_SMTP_SECURE === "true";

  return { host, port, secure, auth: { user, pass } };
}

export function isQuirkEmailConfigured(): boolean {
  return smtpConfig() !== null;
}

export async function sendMailViaSmtp(options: {
  from: string;
  to: string | string[];
  replyTo?: string;
  subject: string;
  text: string;
}): Promise<void> {
  const config = smtpConfig();
  if (!config) {
    throw new Error("SMTP is not configured");
  }
  const transporter = nodemailer.createTransport(config);
  await transporter.sendMail(options);
}
