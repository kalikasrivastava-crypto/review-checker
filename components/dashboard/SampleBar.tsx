/** A clear "this is sample data" strip, shown above results whenever the built-in sample is loaded. */
export default function SampleBar({ count, onUseOwn }: { count: number; onUseOwn: () => void }) {
  return (
    <div className="alert alert--warning sample-bar" role="note">
      <p>
        <strong>Sample data.</strong> These results come from {count.toLocaleString()} made-up reviews, not from a real restaurant.
      </p>
      <button type="button" className="button button--secondary button--sm" onClick={onUseOwn}>
        Use my own reviews
      </button>
    </div>
  );
}
