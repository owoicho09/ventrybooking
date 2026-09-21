'use client';

import { useState } from 'react';

const LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          style={{ background: 'none', border: 'none', padding: 3, cursor: 'pointer', color: i <= active ? '#f59e0b' : 'var(--color-border)' }}
        >
          <svg width={32} height={32} viewBox="0 0 24 24" fill={i <= active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        </button>
      ))}
      {active > 0 && <span className="ml-1 text-sm font-medium" style={{ color: '#f59e0b' }}>{LABELS[active - 1]}</span>}
    </div>
  );
}
