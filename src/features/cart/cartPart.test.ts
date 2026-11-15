import { describe, expect, it } from 'vitest';
import type { CartDto, CartLineDto } from '../../api/generated';
import { cartRows, lineMode, lineOf, partOf, positionCount, takenIn } from './cartPart';

const line = (patch: Partial<CartLineDto>) => ({ itemId: 'i', name: 'n', quantity: 1, total: 100, ...patch }) as CartLineDto;
const cart = (lines: CartLineDto[]) => ({ lines, total: 999, goodsTotal: 999, skipped: [], saleSavings: 5 }) as unknown as CartDto;

describe('оптовая и розничная заявки', () => {
  it('строка — в заявке своего режима; без режима упаковки оптом, штуки в розницу', () => {
    expect(lineMode(line({ mode: 'RETAIL', split: { packs: 1 } as never }))).toBe('RETAIL');
    expect(lineMode(line({ split: { packs: 2 } as never }))).toBe('WHOLESALE');
    expect(lineMode(line({}))).toBe('RETAIL');
  });

  it('часть корзины — строки своего вида и их сумма', () => {
    const both = cart([line({ itemId: 'a', total: 300, mode: 'WHOLESALE' }), line({ itemId: 'b', total: 50 })]);
    const wholesale = partOf(both, 'WHOLESALE');
    expect(wholesale.lines.map((one) => one.itemId)).toEqual(['a']);
    expect(wholesale.total).toBe(300);
    expect(partOf(both, 'RETAIL').total).toBe(50);
  });
});

describe('один товар в обеих заявках', () => {
  const both = cart([line({ itemId: 'c', mode: 'WHOLESALE', quantity: 40 }), line({ itemId: 'c', mode: 'RETAIL', quantity: 3 }),
    line({ itemId: 'n', quantity: 5 })]);

  it('строка ищется в своей заявке; у товара без двух способов — единственная', () => {
    expect(lineOf(both, 'c', 'RETAIL')?.quantity).toBe(3);
    expect(lineOf(both, 'c', 'WHOLESALE')?.quantity).toBe(40);
    expect(lineOf(both, 'n', 'RETAIL')?.quantity).toBe(5);
    expect(lineOf(cart([line({ itemId: 'c', mode: 'WHOLESALE' })]), 'c', 'RETAIL')).toBeUndefined();
  });

  it('«взят» — только в заявке выбранного способа', () => {
    const wholesaleOnly = cart([line({ itemId: 'c', mode: 'WHOLESALE' }), line({ itemId: 'n' })]);
    expect([...takenIn(wholesaleOnly, 'RETAIL')]).toEqual(['n']);
    expect([...takenIn(wholesaleOnly, 'WHOLESALE')].sort()).toEqual(['c', 'n']);
  });
});

describe('линейка одежды в корзине', () => {
  const sized = (itemId: string, key: string) => line({ itemId, mode: 'WHOLESALE', line: { key } as never });

  it('размеры одной линейки — одна строка на месте первого размера, прочие строки как были', () => {
    const lines = [sized('48', 'jacket|black'), line({ itemId: 'pants' }), sized('50', 'jacket|black'), sized('48m', 'jacket|mocha')];
    const rows = cartRows(lines);
    expect(rows.map((row) => (row.kind === 'one' ? row.line.itemId : row.rows.map((one) => one.itemId).join('+'))))
      .toEqual(['48+50', 'pants', '48m']);
  });

  it('линейка из шести размеров — одна позиция', () => {
    expect(positionCount(['46', '48', '50', '52', '54', '56'].map((size) => sized(size, 'k')))).toBe(1);
    expect(positionCount([sized('48', 'k'), line({ itemId: 'x' })])).toBe(2);
    expect(positionCount(undefined)).toBe(0);
  });
});
