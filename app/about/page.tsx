import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "About · DineTrust",
  description: "How DineTrust turns customer reviews into themes and improvement priorities.",
};

export default function About() {
  return (
    <>
      <SiteHeader current="about" />
      <main id="main">
        <div className="container">
          <article className="prose">
            <p className="eyebrow">About DineTrust</p>
            <h1>See what your customers keep mentioning, and where to look first.</h1>

            <h2>The problem</h2>
            <p>
              Reviews pile up, and reading hundreds of them to spot what keeps going wrong takes hours. A few loud comments can feel like a
              pattern when they are not, and a quiet problem that many guests mention can go unnoticed.
            </p>

            <h2>How it works</h2>
            <ol>
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
                practical tasks to consider.
              </li>
            </ol>
            <p>
              The results show what customers mention, not why it happens. Use them as a place to start checking, and compare them with your own
              records before changing anything.
            </p>

            <h2>Honest about its limits</h2>
            <ul>
              <li>By default it uses simple phrase rules, not AI. They read English only and can misread sarcasm or unusual wording. You can switch on optional AI analysis, and each result page says which method was used.</li>
              <li>Every number is a count of reviews from your file, worked out by this app even when the AI is used. Sample data is made up and always labelled.</li>
              <li>Your file is read in your browser and isn&apos;t saved. If you switch on AI analysis, the review text (without reviewer names, emails, links or phone numbers) is sent to Google&apos;s Gemini.</li>
              <li>Progress ticked in the action plan is kept for the current visit only.</li>
            </ul>

            <div className="hero__actions" style={{ marginTop: 32 }}>
              <Link href="/analyse" className="button button--primary button--lg">
                Analyse your reviews
              </Link>
              <Link href="/analyse#sample" className="button button--secondary button--lg">
                Explore sample data
              </Link>
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
