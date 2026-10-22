/** A short, plain explanation of which records DineTrust uses. Shown from the welcome screen and the help dialog. */
export default function DataNeeds() {
  return (
    <div className="data-needs">
      <p>You don&apos;t need everything. The more you add, the more DineTrust can check.</p>
      <ul className="needs-list">
        <li>
          <strong>Opening hours</strong> <span className="req">needed</span>
          <span>Spots a visit a review claims when you were closed.</span>
        </li>
        <li>
          <strong>Tables and biggest group</strong> <span className="req">needed</span>
          <span>Spots a group bigger than you can seat.</span>
        </li>
        <li>
          <strong>Bills</strong> <span className="req req-opt">optional · CSV</span>
          <span>Checks whether a table of that size paid around that time, and whether the dish was ordered.</span>
        </li>
        <li>
          <strong>Reservations</strong> <span className="req req-opt">optional · CSV</span>
          <span>Checks claims like &ldquo;we had booked for 8&rdquo;.</span>
        </li>
      </ul>
      <p className="muted small">
        No bills or reservations yet? You can still start. Anything DineTrust can&apos;t check is marked &ldquo;can&apos;t
        verify&rdquo; and is never counted against a review.
      </p>
    </div>
  );
}
