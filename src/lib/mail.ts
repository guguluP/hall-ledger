import { appendFile } from "fs/promises";
import path from "path";
import nodemailer from "nodemailer";
import { appUrl } from "@/lib/auth/csrf";
import { HttpError } from "@/lib/http-error";

export const DEV_MAIL_LOG = path.join(process.cwd(), ".mail-dev.log");

export async function sendMail(to: string, subject: string, text: string, link: string) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "production") {
      console.error("[mail] SMTP is not configured");
      throw new HttpError(500, "Email is not configured");
    }
    const line = `${new Date().toISOString()}\t${to}\t${subject}\t${link}\n`;
    console.info("[mail]", line.trim());
    await appendFile(DEV_MAIL_LOG, line);
    return;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || "Hall Ledger <noreply@localhost>",
    to,
    subject,
    text,
  });
}

export function linkFor(pathname: string) {
  return `${appUrl()}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
