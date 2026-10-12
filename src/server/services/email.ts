import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain-text body. An HTML version is derived from it. */
  text: string;
  /** Optional call-to-action rendered as a link under the text. */
  action?: { label: string; url: string };
};

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const e = env();
  if (!e.SMTP_HOST) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD ?? "" } : undefined,
  });
  return transporter;
}

export function isEmailConfigured(): boolean {
  return !!env().SMTP_HOST;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function toHtml(message: EmailMessage): string {
  const paragraphs = message.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const action = message.action
    ? `<p style="margin:20px 0"><a href="${escapeHtml(message.action.url)}" style="background:#0f5c4d;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(message.action.label)}</a></p><p style="margin:0;color:#666;font-size:12px">If the button does not work, copy this link: ${escapeHtml(message.action.url)}</p>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;max-width:560px">${paragraphs}${action}</div>`;
}

/**
 * Sends an email. Never throws: delivery problems are logged so that a mail
 * outage cannot break enrollment, grading or other core workflows.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const e = env();
  const transport = getTransporter();
  const text = message.action
    ? `${message.text}\n\n${message.action.label}: ${message.action.url}`
    : message.text;

  if (!transport) {
    if (e.NODE_ENV === "production") {
      console.error(`[email] SMTP is not configured; "${message.subject}" was not sent.`);
      return false;
    }
    if (e.NODE_ENV !== "test") {
      console.info(
        `\n[email:dev] (SMTP not configured, printing instead)\nTo: ${message.to}\nSubject: ${message.subject}\n\n${text}\n`,
      );
    }
    return true;
  }

  try {
    await transport.sendMail({
      from: e.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text,
      html: toHtml(message),
    });
    return true;
  } catch (error) {
    console.error(`[email] failed to send "${message.subject}"`, error);
    return false;
  }
}
