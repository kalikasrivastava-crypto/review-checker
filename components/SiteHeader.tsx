import Link from "next/link";
import Logo from "./Logo";

/** The top bar of the public pages (home and About). */
export default function SiteHeader({ current }: { current?: "home" | "about" }) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Logo />
        <nav className="site-nav" aria-label="Main">
          <Link href="/" aria-current={current === "home" ? "page" : undefined}>
            Home
          </Link>
          <Link href="/about" aria-current={current === "about" ? "page" : undefined}>
            About
          </Link>
          <Link href="/analyse" className="button button--primary button--sm">
            Analyse your reviews
          </Link>
        </nav>
      </div>
    </header>
  );
}
