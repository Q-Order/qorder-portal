import { describe, expect, it } from 'vitest';
import { perPiece } from './itemParts';

/** Пресс «… — линейка XS–XXL»: цена за штуку крупно, цена пресса — строкой ниже (2026-11-14). */
describe('perPiece', () => {
  it('пресс из 6 шт за 80 000 — 13 333,33 за шт, цена пресса запомнена', () => {
    const shown = perPiece({ price: 80000, oldPrice: 90000, unit: 'линейка', packSize: 6 });
    expect(shown.price).toBe(13333.33);
    expect(shown.oldPrice).toBe(15000);
    expect(shown.unit).toBe('шт');
    expect(shown.press).toEqual({ unit: 'линейка', pieces: 6, price: 80000 });
  });

  it('состав карточки считается по штукам участников', () => {
    expect(perPiece({ price: 60000, unit: 'пресс', pack: [{ quantity: 2 }, { quantity: 4 }] }).price).toBe(10000);
  });

  it('обычный товар — без изменений', () => {
    const item = { price: 5000, unit: 'шт' };
    expect(perPiece(item)).toBe(item);
  });

  // «Ваша цена» пресса — тоже за штуку крупно (2026-11-15): цена пресса уже со скидкой клиента.
  it('«ваша цена» пресса — за штуку', () => {
    expect(perPiece({ price: 72000, unit: 'линейка', packSize: 6, yourPrice: true }).price).toBe(12000);
  });
});
