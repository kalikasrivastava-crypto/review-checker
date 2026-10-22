import Link from "next/link";
import Welcome from "@/components/Welcome";

export default function Landing() {
  return (
    <div className="shell narrow-shell">
      <header className="masthead">
        <h1>DineTrust</h1>
        <p>Customer feedback insights for restaurants.</p>
      </header>

      <Welcome />

      <section className="panel">
        <h2>How it keeps to the facts</h2>
        <ul className="plain-list">
          <li>
            <strong>Every number is a count from your file.</strong> Nothing is estimated or invented. Sample data is always labelled as sample data.
          </li>
          <li>
            <strong>It shows what customers mention, not why.</strong> A theme that comes up often is a place to start checking, not proof of a cause.
          </li>
          <li>
            <strong>Your reviews stay on your computer.</strong> The file is read in your browser. It isn&apos;t uploaded, saved or sent to an AI.
          </li>
        </ul>
      </section>

      <p className="footer-note">
        <Link href="/about">About DineTrust</Link>
      </p>
    </div>
  );
}
