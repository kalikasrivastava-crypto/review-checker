import Link from "next/link";
import Welcome from "@/components/Welcome";

export default function Landing() {
  return (
    <div className="shell narrow-shell">
      <header className="masthead">
        <h1>DineTrust</h1>
        <p>Check a bad Google review against your own records, then reply calmly.</p>
      </header>

      <Welcome />

      <section className="panel">
        <h2>Why owners use it</h2>
        <ul className="plain-list">
          <li>
            <strong>It compares, it doesn&apos;t accuse.</strong> Each claim in a review is checked against your hours, tables, bills and
            reservations, and the result is a clear list of what fits and what doesn&apos;t.
          </li>
          <li>
            <strong>Your records stay yours.</strong> The AI only reads the review text. Your bills and your guests&apos; details never go to it.
          </li>
          <li>
            <strong>You decide.</strong> DineTrust drafts a calm reply and a report for Google. Nothing is posted for you.
          </li>
        </ul>
      </section>

      <p className="footer-note">
        <Link href="/about">About DineTrust</Link>
      </p>
    </div>
  );
}
