'use client';

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

const categories = ['All', 'Concerts', 'Uni Parties', 'Sports', 'Theater', 'Festivals', 'Conferences'];
const cities     = ['All Cities', 'Lagos', 'Abuja', 'Port Harcourt'];
const dates      = ['All', 'This Weekend', 'This Month'];
const sorts      = ['Soonest', 'Most Popular', 'Price Low', 'Price High'];

interface FilterBarProps {
  onSearch?: (q: string) => void;
  onFilter?: (filter: { category: string; city: string; date: string; sort: string }) => void;
}

export function FilterBar({ onSearch, onFilter }: FilterBarProps) {
  const [query,          setQuery]          = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [city,           setCity]           = useState('All Cities');
  const [date,           setDate]           = useState('All');
  const [sort,           setSort]           = useState('Soonest');

  const didMount = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Emit filter changes whenever dropdowns/chips change — but skip the initial mount
  // to avoid a duplicate fetch alongside the parent's own initial useEffect.
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    onFilter?.({ category: activeCategory, city, date, sort });
  }, [activeCategory, city, date, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => onSearch?.(value), 300);
  };

  return (
    <div
      className="sticky top-16 z-30 border-b py-4"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-bg) 90%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-dim)' }} />
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search events, venues, organizers…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm outline-none focus:border-[var(--color-purple)] focus:ring-1 focus:ring-[var(--color-purple)] placeholder:text-[var(--color-text-dim)]"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category chips — horizontal scroll on mobile */}
          <div className="flex gap-1.5 flex-1 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0"
                style={{
                  backgroundColor: activeCategory === cat ? 'var(--color-purple)' : 'var(--color-surface)',
                  color:           activeCategory === cat ? '#fff' : 'var(--color-text-muted)',
                  border:          `1px solid ${activeCategory === cat ? 'var(--color-purple)' : 'var(--color-border)'}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Dropdowns */}
          <div className="flex gap-2 flex-wrap">
            {([
              { value: city, setValue: setCity, options: cities,  label: 'Location' },
              { value: date, setValue: setDate, options: dates,   label: 'Date' },
              { value: sort, setValue: setSort, options: sorts,   label: 'Sort' },
            ] as { value: string; setValue: (v: string) => void; options: string[]; label: string }[]).map(({ value, setValue, options, label }) => (
              <select
                key={label}
                value={value}
                onChange={e => setValue(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border outline-none focus:border-[var(--color-purple)] appearance-none cursor-pointer"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
