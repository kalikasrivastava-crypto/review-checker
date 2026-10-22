/** A small ⓘ that explains a term in plain words on hover, focus or tap. */
export default function Hint({ tip, label }: { tip: string; label?: string }) {
  return (
    <button type="button" className="hint" aria-label={label ? `${label}: ${tip}` : tip} data-tip={tip}>
      <span aria-hidden="true">i</span>
    </button>
  );
}
