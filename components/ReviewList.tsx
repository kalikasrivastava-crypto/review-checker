import Stars from "./Stars";
import type { Review } from "@/lib/types";
import type { Tag } from "@/lib/patterns";

interface Props {
  reviews: Review[];
  selectedId: string | null;
  tags: Record<string, Tag[]>;
  onSelect: (review: Review) => void;
}

function initials(name = "?"): string {
  return name
    .replace(/[^A-Za-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";
}

function shortDate(date: string): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ReviewList({ reviews, selectedId, tags, onSelect }: Props) {
  return (
    <ul className="review-list">
      {reviews.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            className="review-card"
            aria-pressed={r.id === selectedId}
            onClick={() => onSelect(r)}
          >
            <span className={`avatar avatar-${(r.author ?? "?").charCodeAt(0) % 4}`} aria-hidden="true">
              {initials(r.author)}
            </span>
            <span>
              <span className="review-head">
                <span className="review-author">{r.author}</span>
                <Stars rating={r.rating} />
                <span>{shortDate(r.date)}</span>
              </span>
              <span className="review-snippet">{r.text}</span>
              {(tags[r.id ?? ""] ?? []).length > 0 && (
                <span className="tags">
                  {tags[r.id ?? ""].map((t) => (
                    <span key={t} className={t === "Part of a burst" ? "tag tag-burst" : "tag"}>
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
