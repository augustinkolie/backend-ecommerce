import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { createTransport, type Transporter } from "nodemailer";
import { env } from "./env";

let transporter: Transporter | undefined;

/** Envoi SMTP (Mailpit en dev, Resend SMTP ou autre en production). N'interrompt jamais le parcours. */
export async function sendMail(to: string, subject: string, element: ReactElement) {
  try {
    transporter ??= createTransport(env().SMTP_URL);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    await transporter.sendMail({ from: env().MAIL_FROM, to, subject, html, text });
    return true;
  } catch (err) {
    console.warn("[mail] envoi impossible", (err as Error).message);
    return false;
  }
}
