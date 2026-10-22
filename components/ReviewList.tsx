import type { Review } from "@/lib/types";

interface Props {
  reviews: Review[];
  selectedId: string | null;
  onSelect: (review: Review) => void;
}

export default function ReviewList({ reviews, selectedId, onSelect }: Props) {
  return (
    <ul className="review-list">
      {reviews.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            className={r.id === selectedId ? "review-item selected" : "review-item"}
            onClick={() => onSelect(r)}
          >
            <span className="review-meta">
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)} · {r.author} · {r.date.slice(0, 10)}
            </span>
            <span className="review-snippet">{r.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
