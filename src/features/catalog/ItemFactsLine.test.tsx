import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../i18n';
import { ItemFacts } from './itemParts';

/** Одежда оптом — линейками (2026-11-14): «Продаётся поштучно» у неё неверно и не показывается. */
describe('ItemFacts у линейки', () => {
  it('у линейки в «Оптом» нет «поштучно», у штучного товара — есть', () => {
    const { rerender } = render(<ItemFacts pills item={{ unit: 'шт', terms: { hit: false, novelty: false, ageRestricted: false },
      wholesale: { unit: 'линейка', packQty: 4, pieceUnit: 'шт', retail: false, tiers: [{ from: 1, price: 160000 }], linePieces: 4, piecePrice: 40000 } }} />);
    expect(screen.queryByText('Продаётся поштучно')).not.toBeInTheDocument();
    rerender(<ItemFacts pills item={{ unit: 'шт', terms: { hit: false, novelty: false, ageRestricted: false } }} />);
    expect(screen.getByText('Продаётся поштучно')).toBeInTheDocument();
  });
});
