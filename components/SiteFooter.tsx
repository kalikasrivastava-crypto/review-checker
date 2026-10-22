import Link from "next/link";
import Logo from "./Logo";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__inner">
          <div>
            <Logo />
            <p>Customer feedback insights for restaurants. See what guests keep mentioning and where to look first.</p>
          </div>
          <nav aria-label="Footer">
            <Link href="/">Home</Link>
            <Link href="/analyse">Analyse your reviews</Link>
            <Link href="/analyse#sample">Sample data</Link>
            <Link href="/about">About</Link>
          </nav>
        </div>
        <p className="site-footer__fine">
          DineTrust shows what customers mention, not why it happens. Sample data is made up and always labelled. Reviews are read in your browser and
          are never uploaded.
        </p>
      </div>
    </footer>
  );
}
