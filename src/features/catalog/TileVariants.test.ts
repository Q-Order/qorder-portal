import { describe, expect, it } from 'vitest';
import { shownOptions } from './TileVariants';

describe('какие значения влезают в строку плитки', () => {
  const sizes = ['S', 'M', 'L', 'XS', 'XXL', 'XL'];
  // Кнопка 36, «+N» 36, зазор 4.
  const narrow = sizes.map(() => 36);

  it('все влезают — все, без «+N»', () => {
    expect(shownOptions(sizes.slice(0, 5), narrow, 36, 196)).toEqual(['S', 'M', 'L', 'XS', 'XXL']);
  });

  it('не влезают — столько, чтобы рядом встал «+N»', () => {
    expect(shownOptions(sizes, narrow, 36, 196)).toEqual(['S', 'M', 'L', 'XS']);
  });

  it('выбранное за «+N» видно, и место считается по его ширине', () => {
    const wide = [36, 36, 36, 36, 36, 80];
    expect(shownOptions(sizes, wide, 36, 204, 'XL')).toEqual(['S', 'M', 'XL']);
    expect(shownOptions(sizes, wide, 36, 196, 'XL')).toEqual(['S', 'XL']);
  });

  it('совсем узко — одно значение', () => {
    expect(shownOptions(sizes, narrow, 36, 40, 'L')).toEqual(['L']);
  });
});
