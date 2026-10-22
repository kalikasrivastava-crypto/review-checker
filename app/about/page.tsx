import type { Metadata } from "next";
import Link from "next/link";
import TryDemoButton from "@/components/TryDemoButton";

export const metadata: Metadata = {
  title: "About DineTrust",
  description: "How DineTrust helps restaurant owners tell fair bad reviews from suspicious ones.",
};

export default function About() {
  return (
    <div className="shell about">
      <header className="masthead">
        <h1>
          <Link href="/" className="masthead-title">
            DineTrust
          </Link>
        </h1>
        <p>Know which bad reviews to worry about, and reply with a calm head.</p>
      </header>

      <div className="narrow">
        <section className="about-section">
          <h2>The problem</h2>
          <p>
            One unfair review can cost you real customers, and checking each one by hand can take an evening. Some bad
            reviews are fake, copied from somewhere else, or about a visit that never happened. Others are fair, and
            deserve a kind and quick answer. It is hard to tell which is which in the middle of a shift.
          </p>
        </section>

        <section className="about-section">
          <h2>How it works</h2>
          <ol className="about-steps">
            <li>
              <strong>Tell it about your restaurant.</strong> Your hours, tables and, if you like, your bills and
              reservations.
            </li>
            <li>
              <strong>It reads each review.</strong> It picks out the facts the reviewer claims: the day, the time, how
              many people, what they ordered.
            </li>
            <li>
              <strong>It compares those facts with your records.</strong> Every claim is marked as a match, a mismatch
              or no record, and the review gets a score with the reasons shown, so you can see why.
            </li>
            <li>
              <strong>You decide what to do.</strong> It drafts a calm reply in English, Hindi or Hinglish, writes a
              PDF report you can attach to a Google report if the review looks fake, and prepares a WhatsApp note for
              your manager if the complaint is fair. Nothing is posted or sent for you.
            </li>
          </ol>
          <p className="muted">A score is a warning sign, not proof. The final call is always yours.</p>
        </section>

        <section className="about-section">
          <h2>Privacy: your records never go to the AI</h2>
          <ul className="about-list">
            <li>
              The AI sees only the text of a review. When you ask for a reply it also sees which claims matched, but never
              the details from your records.
            </li>
            <li>
              Your bills, reservations, opening hours, phone and email are checked by plain code in this app. Your files
              and settings are kept in your own browser.
            </li>
            <li>
              To run a check, your records are sent to this app&apos;s own server, which does the comparison and does not
              keep them.
            </li>
            <li>Your contact details are added to a reply only after the AI has written it.</li>
          </ul>
        </section>

        <section className="about-section about-cta">
          <h2>See it in action</h2>
          <p>The demo has a made-up restaurant, a week of bills and 23 reviews, some fair and some suspicious.</p>
          <TryDemoButton />
        </section>
      </div>

      <p className="footer-note">
        AI-assisted – check before posting. <Link href="/">Back to the app</Link>
      </p>
    </div>
  );
}
