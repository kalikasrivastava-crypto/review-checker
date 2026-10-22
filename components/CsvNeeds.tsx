/** A short, plain explanation of the file DineTrust needs. Shown from the home page. */
export default function CsvNeeds() {
  return (
    <div className="data-needs">
      <p>You need one file: a spreadsheet of your customer reviews, saved as CSV. One review per row.</p>
      <ul className="needs-list">
        <li>
          <strong>review_text</strong> <span className="req">needed</span>
          <span>The full text of the review.</span>
        </li>
        <li>
          <strong>rating</strong> <span className="req req-opt">optional</span>
          <span>Stars from 1 to 5. It adds an average and a rating chart.</span>
        </li>
        <li>
          <strong>date</strong> <span className="req req-opt">optional</span>
          <span>When it was posted, for example 2026-10-17.</span>
        </li>
        <li>
          <strong>reviewer</strong> <span className="req req-opt">optional</span>
          <span>Who wrote it.</span>
        </li>
      </ul>
      <p className="muted small">
        In Excel or Google Sheets, choose File, then Save as or Download, then CSV. Copied your reviews from Google? Paste them into a sheet
        with a <code>review_text</code> column first. You can{" "}
        <a href="/dinetrust-reviews-template.csv" download>
          download a template
        </a>
        . Reviews are read in your browser and are not uploaded anywhere.
      </p>
    </div>
  );
}
