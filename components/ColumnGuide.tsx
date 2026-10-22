type Kind = "bills" | "reservations";

const COLUMNS: Record<Kind, { name: string; meaning: string; example: string; required: boolean }[]> = {
  bills: [
    { name: "date", meaning: "Day of the visit", example: "2026-10-17", required: true },
    { name: "time", meaning: "When the table was billed, 24-hour", example: "20:15", required: true },
    { name: "party_size", meaning: "How many guests were at the table", example: "4", required: true },
    { name: "bill_no", meaning: "Your bill number", example: "B-1001", required: false },
    { name: "items", meaning: "Dishes ordered, separated by semicolons", example: "Paneer Tikka; Dal Makhani", required: false },
  ],
  reservations: [
    { name: "date", meaning: "Day of the booking", example: "2026-10-17", required: true },
    { name: "time", meaning: "Booked time, 24-hour", example: "20:00", required: true },
    { name: "party_size", meaning: "How many guests were booked", example: "4", required: true },
    { name: "booking_no", meaning: "Your booking number", example: "R-201", required: false },
  ],
};

/** A visible table of the columns a file should have. */
export default function ColumnGuide({ kind }: { kind: Kind }) {
  return (
    <div className="table-scroll">
      <table className="column-guide">
        <thead>
          <tr>
            <th scope="col">Column name</th>
            <th scope="col">What it means</th>
            <th scope="col">Example</th>
            <th scope="col">Needed?</th>
          </tr>
        </thead>
        <tbody>
          {COLUMNS[kind].map((c) => (
            <tr key={c.name}>
              <td>
                <code>{c.name}</code>
              </td>
              <td>{c.meaning}</td>
              <td>{c.example}</td>
              <td>
                <span className={`req ${c.required ? "" : "req-opt"}`}>{c.required ? "required" : "optional"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
