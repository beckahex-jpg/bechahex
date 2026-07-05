import { useState } from 'react';
import { Star } from 'lucide-react';

const SIZE_CLASSES = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-7 h-7'
} as const;

type StarSize = keyof typeof SIZE_CLASSES;

interface StarRatingProps {
  value: number;
  count?: number | null;
  size?: StarSize;
  showCount?: boolean;
  emptyLabel?: string;
}

export function StarRating({ value, count, size = 'sm', showCount = true, emptyLabel }: StarRatingProps) {
  const starClass = SIZE_CLASSES[size];

  if (!count || count <= 0) {
    if (!emptyLabel) return null;
    return <span className="text-xs font-medium text-gray-500">{emptyLabel}</span>;
  }

  const rounded = Math.round(value);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starClass} ${
              star <= rounded ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-gray-700">{Number(value).toFixed(1)}</span>
      {showCount && (
        <span className="text-xs text-gray-500">
          ({count} {count === 1 ? 'review' : 'reviews'})
        </span>
      )}
    </div>
  );
}

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  size?: StarSize;
  disabled?: boolean;
}

export function StarRatingInput({ value, onChange, size = 'lg', disabled = false }: StarRatingInputProps) {
  const [hovered, setHovered] = useState(0);
  const starClass = SIZE_CLASSES[size];
  const active = hovered || value;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`Rate ${star} out of 5`}
          onMouseEnter={() => setHovered(star)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Star
            className={`${starClass} transition-colors ${
              star <= active ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
