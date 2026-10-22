import Link from "next/link";
import Logo from "../Logo";
import { IconOverview, IconPlan, IconThemes, IconUpload } from "../UiIcons";

export type View = "upload" | "overview" | "themes" | "plan";

export interface SourceInfo {
  kind: "sample" | "upload";
  name: string;
  reviews: number;
}

interface Props {
  view: View;
  onNavigate: (v: View) => void;
  source: SourceInfo | null;
  themeCount: number | null;
  planCount: number | null;
  children: React.ReactNode;
}

function Nav({ view, onNavigate, themeCount, planCount }: Pick<Props, "view" | "onNavigate" | "themeCount" | "planCount">) {
  const items: { id: View; label: string; icon: React.ReactNode; count: number | null }[] = [
    { id: "upload", label: "Upload reviews", icon: <IconUpload />, count: null },
    { id: "overview", label: "Overview", icon: <IconOverview />, count: null },
    { id: "themes", label: "Themes", icon: <IconThemes />, count: themeCount },
    { id: "plan", label: "Action plan", icon: <IconPlan />, count: planCount },
  ];
  return (
    <>
      {items.map((it) => (
        <button key={it.id} type="button" className="nav-item" aria-current={view === it.id ? "page" : undefined} onClick={() => onNavigate(it.id)}>
          {it.icon}
          <span>{it.label}</span>
          {it.count !== null && it.count > 0 && <span className="nav-item__count">{it.count}</span>}
        </button>
      ))}
    </>
  );
}

function SourceBadge({ source }: { source: SourceInfo | null }) {
  if (!source) return <span className="badge">No reviews loaded</span>;
  return source.kind === "sample" ? <span className="badge badge--sample">Sample data</span> : <span className="badge badge--accent">Your file</span>;
}

/** The dashboard frame: a sidebar on large screens, a top bar with tabs on small ones. */
export default function AppShell({ view, onNavigate, source, themeCount, planCount, children }: Props) {
  return (
    <div className="app">
      <a href="#content" className="skip-link">
        Skip to content
      </a>

      <aside className="app__sidebar" aria-label="Sidebar">
        <Logo />
        <nav aria-label="Dashboard sections">
          <div className="nav-list">
            <Nav view={view} onNavigate={onNavigate} themeCount={themeCount} planCount={planCount} />
          </div>
        </nav>
        <div className="source-box">
          <SourceBadge source={source} />
          <p>{source ? (source.kind === "sample" ? `${source.reviews.toLocaleString()} made-up reviews` : `${source.name} · ${source.reviews.toLocaleString()} reviews`) : "Upload a CSV file or try the sample data."}</p>
        </div>
        <div className="side-links">
          <Link href="/">Home</Link>
          <Link href="/about">About DineTrust</Link>
        </div>
      </aside>

      <div className="app__main">
        <div className="app__topbar">
          <Logo />
          <SourceBadge source={source} />
        </div>
        <nav className="app__tabs" aria-label="Dashboard sections">
          <Nav view={view} onNavigate={onNavigate} themeCount={themeCount} planCount={planCount} />
        </nav>
        <main id="content" className="app__content">
          {children}
        </main>
      </div>
    </div>
  );
}
