import { useId } from 'react';
export function ConceptGlyph({ name, variant = 'a' }: { name: string; variant?: 'a' | 'b' }) {
  const id = useId().replace(/:/g, '');
  const organic = ['蜂群', '生物', '海洋', '医学'].some((value) => name.includes(value));
  const cells = [
    [150, 95],
    [119, 77],
    [181, 77],
    [119, 113],
    [181, 113],
    [150, 59],
    [150, 131],
  ];
  return (
    <svg
      className={`concept-glyph glyph-${variant}`}
      viewBox="0 0 300 190"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor="currentColor" stopOpacity=".22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={`${id}-surface`}
          x1="90"
          y1="40"
          x2="210"
          y2="150"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="currentColor" stopOpacity=".9" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".3" />
        </linearGradient>
      </defs>
      <ellipse cx="150" cy="100" rx="110" ry="85" fill={`url(#${id}-halo)`} />
      <ellipse cx="150" cy="154" rx="72" ry="13" fill="currentColor" opacity=".08" />
      <ellipse
        cx="150"
        cy="97"
        rx="111"
        ry="65"
        stroke="currentColor"
        opacity=".2"
        transform="rotate(-22 150 97)"
      />
      <ellipse
        cx="150"
        cy="97"
        rx="91"
        ry="81"
        stroke="currentColor"
        strokeDasharray="2 8"
        opacity=".16"
      />
      {organic ? (
        <g stroke="currentColor" strokeWidth="1.2">
          {cells.map(([x, y], i) => (
            <g key={i}>
              <path
                d={`M${x - 18} ${y}l9 -16h18l9 16 -9 16h-18Z`}
                fill={`url(#${id}-surface)`}
                opacity={i === 0 ? 1 : 0.65}
              />
              <path d={`M${x - 9} ${y - 16}l9 16 18 0M${x} ${y}v16`} opacity=".45" />
            </g>
          ))}
          <circle cx="76" cy="79" r="4" fill="currentColor" opacity=".6" />
          <circle cx="218" cy="115" r="3" fill="currentColor" opacity=".5" />
          <path d="M91 41l6 6m-6 0 6-6M222 62h8m-4-4v8" opacity=".5" />
        </g>
      ) : (
        <g stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
          <path d="M105 58h90l37 34-82 69-82-69Z" fill={`url(#${id}-surface)`} />
          <path d="M105 58 127 92 150 161 68 92Z" fill="currentColor" opacity=".12" />
          <path d="M195 58 173 92 150 161 232 92Z" fill="currentColor" opacity=".32" />
          <path d="M105 58h90l-22 34h-46Z" fill="currentColor" opacity=".3" />
          <path d="M68 92h164M105 58l22 34 23 69 23-69 22-34M127 92h46" opacity=".8" />
          <path d="M206 43h14m-7-7v14" strokeWidth="1.5" />
          <path d="M86 117h9m-4.5-4.5v9" opacity=".5" />
          <circle cx="150" cy="45" r="2" fill="currentColor" />
        </g>
      )}
    </svg>
  );
}
