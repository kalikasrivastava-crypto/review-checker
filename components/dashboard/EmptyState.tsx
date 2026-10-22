import { IconFile } from "../UiIcons";

/** Shown in place of results when no reviews have been loaded yet. */
export default function EmptyState({
  title,
  text,
  onUpload,
  onSample,
}: {
  title: string;
  text: string;
  onUpload: () => void;
  onSample: () => void;
}) {
  return (
    <section className="card empty">
      <span className="feature__icon">
        <IconFile />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="actions-row">
        <button type="button" className="button button--primary" onClick={onUpload}>
          Upload reviews
        </button>
        <button type="button" className="button button--secondary" onClick={onSample}>
          Use sample data
        </button>
      </div>
    </section>
  );
}
