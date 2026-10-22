import Link from "next/link";
import GlanceCard from "@/components/GlanceCard";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { IconBars, IconFile, IconPlan, IconQuote, IconShield, IconThemes, IconUpload, IconOverview } from "@/components/UiIcons";

const STEPS = [
  { title: "Upload reviews", text: "Drop in a CSV file of customer reviews. Only the review text is required; ratings and dates make the results richer." },
  { title: "Discover insights", text: "See the themes guests keep mentioning, whether each leans positive or negative, and real example reviews." },
  { title: "Take action", text: "Get the top areas to look at first, each with practical next steps to consider." },
];

const FEATURES = [
  { icon: <IconThemes />, title: "Recurring themes", text: "Food quality, service speed, cleanliness, pricing and ambience, counted across every review." },
  { icon: <IconBars />, title: "Sentiment by theme", text: "See at a glance which themes lean positive, negative or mixed." },
  { icon: <IconQuote />, title: "Real examples", text: "Every theme shows actual reviews from your file, so you can read what guests said." },
  { icon: <IconPlan />, title: "Priority issues", text: "The areas raising the most concerns, ranked by the number of reviews that mention them." },
  { icon: <IconOverview />, title: "Practical next steps", text: "Suggestions to check or try for each priority, written as ideas rather than conclusions." },
  { icon: <IconShield />, title: "Private by design", text: "Your file is read in your browser. It isn't uploaded, saved or sent to an AI." },
];

export default function Landing() {
  return (
    <>
      <SiteHeader current="home" />
      <main id="main">
        <div className="container">
          <section className="hero" aria-labelledby="hero-title">
            <div>
              <span className="badge badge--accent">Customer feedback insights for restaurants</span>
              <h1 id="hero-title">Understand what your customers keep telling you.</h1>
              <p className="hero__lead">
                Upload your customer reviews. DineTrust groups the feedback into themes, shows which problems come up most, and suggests where to look
                first.
              </p>
              <div className="hero__actions">
                <Link href="/analyse" className="button button--primary button--lg">
                  Analyse your reviews
                </Link>
                <Link href="/analyse#sample" className="button button--secondary button--lg">
                  Explore sample data
                </Link>
              </div>
              <p className="hero__note">No sign-up. Your file is read in your browser and never uploaded.</p>
            </div>
            <GlanceCard />
          </section>

          <section className="section" id="how-it-works" aria-labelledby="how-title">
            <div className="section__head">
              <p className="eyebrow">How it works</p>
              <h2 id="how-title">From a spreadsheet of reviews to a short list of things to improve</h2>
            </div>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="card step">
                  <span className="step__num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="section" aria-labelledby="features-title">
            <div className="section__head">
              <p className="eyebrow">What you get</p>
              <h2 id="features-title">Clear answers, without reading hundreds of reviews</h2>
            </div>
            <div className="features">
              {FEATURES.map((f) => (
                <article key={f.title} className="card feature">
                  <span className="feature__icon">{f.icon}</span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="section" aria-labelledby="honest-title">
            <div className="card honest">
              <h2 id="honest-title">Built to stay honest</h2>
              <ul>
                <li>Every number is a count of reviews from your file. Nothing is estimated or invented.</li>
                <li>Results show what customers mention, not why it happens. Treat them as a place to start checking.</li>
                <li>Sample data is made up and is always labelled as sample data.</li>
              </ul>
            </div>
          </section>

          <section className="card cta-band" aria-labelledby="cta-title">
            <span className="feature__icon">
              <IconFile />
            </span>
            <h2 id="cta-title">See what your reviews are telling you</h2>
            <p>Upload a CSV file and get your first results in under a minute.</p>
            <div className="hero__actions">
              <Link href="/analyse" className="button button--primary button--lg">
                <IconUpload /> Analyse your reviews
              </Link>
              <Link href="/analyse#sample" className="button button--secondary button--lg">
                Explore sample data
              </Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
