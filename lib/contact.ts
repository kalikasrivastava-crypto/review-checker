/** Contact form: checking what a visitor sent, and writing the two emails. No network here, so it is easy to test. */

export const LIMITS = { name: 100, email: 254, message: 2000 };

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export type ContactCheck = { ok: true; value: ContactInput } | { ok: false; error: string };

const EMAIL = /^[^@\s<>"',;]+@[^@\s<>"',;]+\.[^@\s<>"',;]+$/;

/** Trims and checks the three fields. Control characters are removed, so nothing can break out of an email header. */
export function checkContact(body: unknown): ContactCheck {
  const b = (body ?? {}) as Record<string, unknown>;
  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim() : "");
  const name = clean(b.name).replace(/\s+/g, " ");
  const email = clean(b.email);
  const message = clean(b.message);
  if (!name) return { ok: false, error: "Please enter your name." };
  if (name.length > LIMITS.name) return { ok: false, error: `Your name can be up to ${LIMITS.name} characters.` };
  if (!email || email.length > LIMITS.email || !EMAIL.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (!message) return { ok: false, error: "Please write a message." };
  if (message.length > LIMITS.message) return { ok: false, error: `Your message can be up to ${LIMITS.message} characters.` };
  return { ok: true, value: { name, email, message } };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// A header must be one line.
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

/** The note to the site owner. Reply goes straight to the visitor. */
export function ownerMail(input: ContactInput, owner: string): Mail {
  const text = `New message from the DineTrust contact form\n\nName: ${input.name}\nEmail: ${input.email}\n\n${input.message}\n`;
  return {
    to: owner,
    replyTo: input.email,
    subject: oneLine(`DineTrust contact form: new message from ${input.name}`).slice(0, 150),
    text,
    html: `<p><strong>New message from the DineTrust contact form</strong></p><p>Name: ${escapeHtml(input.name)}<br>Email: ${escapeHtml(input.email)}</p><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
  };
}

/** The automatic reply to the visitor. The wording is fixed; only the greeting uses their name. */
export function acknowledgementMail(input: ContactInput): Mail {
  const first = input.name.split(" ")[0];
  const text = `Hi ${first},\n\nThanks for getting in touch with DineTrust. We have received your message and will reply soon.\n\nFor your records, you wrote:\n\n${input.message}\n\nThis is an automatic reply, so there is no need to answer it.\n\nThe DineTrust team\n`;
  return {
    to: input.email,
    subject: "We got your message – DineTrust",
    text,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Thanks for getting in touch with DineTrust. We have received your message and will reply soon.</p><p>For your records, you wrote:</p><blockquote style="white-space:pre-wrap;margin:0 0 16px;padding-left:12px;border-left:3px solid #1f4d3a">${escapeHtml(input.message)}</blockquote><p>This is an automatic reply, so there is no need to answer it.</p><p>The DineTrust team</p>`,
  };
}
