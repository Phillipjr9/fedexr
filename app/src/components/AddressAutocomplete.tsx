import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { MapPin } from 'lucide-react';
import { findPlaces, type UsPlace } from '@/lib/usPlaces';

export type { UsPlace as AddressPlace } from '@/lib/usPlaces';

interface AddressAutocompleteProps {
  id: string;
  value: string;
  onChange: (city: string) => void;
  /** Fires when the user picks a suggestion, carrying the matched state + ZIP. */
  onSelect?: (place: UsPlace) => void;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  helpText?: string;
}

/**
 * City / ZIP autocomplete backed by the bundled dataset in `@/lib/usPlaces`.
 *
 * Free to run: no geocoding provider, no API key, no request leaves the
 * browser. Picking a suggestion reports the full place so the caller can fill
 * the state and ZIP fields automatically.
 */
export default function AddressAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  label,
  placeholder = 'Start typing a city or ZIP…',
  maxLength = 80,
  required = false,
  helpText,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => findPlaces(value), [value]);
  const listboxId = `${id}-address-options`;

  // Derived rather than synced in an effect: when the query changes the list
  // shrinks or empties, and these fall back to "nothing highlighted" / "closed"
  // on the same render instead of a second pass.
  const activeIndex = highlighted < results.length ? highlighted : -1;
  const showOptions = open && results.length > 0;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function choose(place: UsPlace) {
    onChange(place.city);
    onSelect?.(place);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) => {
        if (event.key === 'ArrowDown') return (current + 1) % results.length;
        return current <= 0 ? results.length - 1 : current - 1;
      });
    } else if (event.key === 'Enter') {
      if (showOptions && activeIndex >= 0) {
        event.preventDefault();
        choose(results[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setHighlighted(-1);
    }
  }

  return (
    <div className="address-autocomplete" ref={wrapperRef}>
      {label && <label htmlFor={id}>{label}</label>}
      <div className="address-autocomplete-field">
        <MapPin size={17} aria-hidden="true" />
        <input
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => setHighlighted(-1)}
          maxLength={maxLength}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={showOptions}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        />
      </div>
      {showOptions && (
        <ul className="address-autocomplete-options" id={listboxId} role="listbox">
          {results.map((place, index) => {
            const optionId = `${listboxId}-${index}`;
            return (
              <li
                key={`${place.city}-${place.region}-${place.postalCode}`}
                id={optionId}
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'is-highlighted' : ''}
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(event) => {
                  // Keep focus in the field so onBlur cannot hide the list first.
                  event.preventDefault();
                  choose(place);
                }}
              >
                <strong>{place.city}</strong>
                <span>
                  {place.region} · {place.postalCode}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {helpText && <small>{helpText}</small>}
    </div>
  );
}
