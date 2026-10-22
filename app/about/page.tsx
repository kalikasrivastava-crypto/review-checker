import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About DineTrust",
  description: "How DineTrust turns customer reviews into themes and improvement priorities.",
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
        <p>See what your customers keep mentioning, and where to look first.</p>
      </header>

      <div className="narrow">
        <section className="about-section">
          <h2>The problem</h2>
          <p>
            Reviews pile up, and reading hundreds of them to spot what keeps going wrong takes hours. A few loud comments can feel like a
            pattern when they are not, and a quiet problem that many guests mention can go unnoticed.
          </p>
        </section>

        <section className="about-section">
          <h2>How it works</h2>
          <ol className="about-steps">
            <li>
              <strong>Upload a CSV file of reviews.</strong> One review per row. A rating and a date are optional.
            </li>
            <li>
              <strong>It groups the feedback into themes.</strong> Food quality, service speed, cleanliness, pricing and ambience, plus
              &ldquo;other&rdquo; for anything that doesn&apos;t fit.
            </li>
            <li>
              <strong>It shows the counts.</strong> For each theme: how many reviews mention it, whether they lean positive or negative, the
              concerns mentioned most, and a few real example reviews.
            </li>
            <li>
              <strong>It suggests where to look first.</strong> The top three areas by the number of reviews raising a concern, each with
              practical next steps to consider.
            </li>
          </ol>
          <p className="muted">
            The results show what customers mention, not why it happens. Use them as a place to start checking, and compare them with your own
            records before changing anything.
          </p>
        </section>

        <section className="about-section">
          <h2>Honest about its limits</h2>
          <ul className="about-list">
            <li>It uses simple phrase rules, not AI. It reads English only and can misread sarcasm or unusual wording.</li>
            <li>Every number is a count of reviews from your file. Sample data is made up and always labelled.</li>
            <li>Your file is read in your browser. It isn&apos;t uploaded, saved or sent anywhere.</li>
          </ul>
        </section>

        <section className="about-section about-cta">
          <h2>See it in action</h2>
          <p>The sample data is 150 made-up reviews, so you can see the results without uploading anything.</p>
          <div className="actions">
            <Link href="/analyse#sample" className="btn btn-primary cta">
              Try it with sample data
            </Link>
            <Link href="/analyse" className="btn cta">
              Analyse my reviews
            </Link>
          </div>
        </section>
      </div>

      <p className="footer-note">
        <Link href="/">Back to the home page</Link>
      </p>
    </div>
  );
}
