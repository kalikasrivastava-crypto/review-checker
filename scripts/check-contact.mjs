// Checks the contact form helpers (lib/contact.ts): validation, and the two emails. No network or database needed.
// Run it with:  node scripts/check-contact.mjs
import { acknowledgementMail, checkContact, ownerMail } from "../lib/contact.ts";

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`}`);
};
const err = (body) => {
  const r = checkContact(body);
  return r.ok ? "ok" : r.error;
};

const good = { name: "  Asha   Rao ", email: " asha@example.com ", message: " Do you support Hindi reviews? " };
check("valid input is trimmed and tidied", checkContact(good), { ok: true, value: { name: "Asha Rao", email: "asha@example.com", message: "Do you support Hindi reviews?" } });
check("missing name", err({ ...good, name: "  " }), "Please enter your name.");
check("missing message", err({ ...good, message: "" }), "Please write a message.");
for (const bad of ["nope", "a@b", "a b@c.com", "a@b.com, c@d.com", "<x>@y.com", ""]) check(`bad email rejected: "${bad}"`, err({ ...good, email: bad }), "Please enter a valid email address.");
check("long name rejected", err({ ...good, name: "x".repeat(101) }).includes("100"), true);
check("long message rejected", err({ ...good, message: "x".repeat(2001) }).includes("2000"), true);
check("max length message accepted", err({ ...good, message: "x".repeat(2000) }), "ok");
check("non-text fields rejected", err({ name: 5, email: {}, message: [] }), "Please enter your name.");
check("empty body rejected", err(null), "Please enter your name.");

const inj = checkContact({ name: "Eve\r\nBcc: x@y.com", email: "e@x.com", message: "hi\u0000there" }).value;
check("control characters are removed from the name and message", [inj.name.includes("\n"), inj.message], [false, "hithere"]);
const om = ownerMail(inj, "owner@example.com");
check("owner email subject is a single line", /[\r\n]/.test(om.subject), false);

const input = checkContact(good).value;
const owner = ownerMail(input, "owner@example.com");
check("owner email goes to the owner, reply goes to the visitor", [owner.to, owner.replyTo], ["owner@example.com", "asha@example.com"]);
check("owner email includes name, email and message", ["Asha Rao", "asha@example.com", "Hindi reviews"].every((s) => owner.text.includes(s)), true);
const ack = acknowledgementMail(input);
check("acknowledgement goes to the visitor and greets them by first name", [ack.to, ack.text.startsWith("Hi Asha,")], ["asha@example.com", true]);
check("acknowledgement does not echo the visitor's email back or promise a refund", /refund|password/i.test(ack.text), false);

const evil = checkContact({ name: '<img src=x onerror=alert(1)>', email: "e@x.com", message: "<script>alert(1)</script> & more" }).value;
check("HTML in a message is escaped in both emails", [ownerMail(evil, "o@x.com").html, acknowledgementMail(evil).html].every((h) => !h.includes("<script>") && !h.includes("<img")), true);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
