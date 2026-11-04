import { useState } from 'react';
import { exclusiveUnitRate, inclusiveUnitRate, money, round } from '../lib/billing';
import type { LineItem } from '../types';

export function InclusiveRateInput({
  item,
  interstate,
  onPrice,
  id,
  required = false,
}: {
  item: Pick<LineItem, 'name' | 'price' | 'gst' | 'unit'>;
  interstate: boolean;
  onPrice: (price: number) => void;
  id?: string;
  required?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const actual = inclusiveUnitRate(item.price, item.gst, interstate);
  const validGst = Number.isFinite(item.gst) && item.gst >= 0 && item.gst <= 100;
  const requested = draft === null || draft === '' ? null : Number(draft);
  const adjusted = requested !== null && Number.isFinite(requested) && round(requested) !== actual;
  return (
    <>
      <input
        id={id}
        required={required}
        aria-label={`Price including GST for ${item.name || 'product'}`}
        type="number"
        min="0"
        max="1000000000000"
        step="0.01"
        disabled={!validGst}
        value={draft ?? actual.toFixed(2)}
        onFocus={() => setDraft(actual.toFixed(2))}
        onChange={(e) => {
          const value = e.target.value;
          setDraft(value);
          const number = Number(value);
          if (Number.isFinite(number) && number >= 0 && number <= 1e12 && validGst)
            onPrice(exclusiveUnitRate(number, item.gst, interstate));
        }}
        onBlur={() => setDraft(null)}
      />
      <small>per {item.unit}</small>
      {adjusted && <small role="status">After GST rounding: {money(actual)}</small>}
    </>
  );
}
