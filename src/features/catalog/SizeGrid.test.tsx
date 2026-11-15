import { describe, expect, it } from 'vitest';
import type { ShowcaseVariantDto } from '../../api/generated';
import { sizeRowsOf } from './SizeGrid';

function variant(itemId: string, colour: string, size: string): ShowcaseVariantDto {
  return {
    itemId, price: 12500,
    fields: [
      { code: 'colour', name: 'Цвет', type: 'OPTION', value: colour },
      { code: 'size', name: 'Размер', type: 'OPTION', value: size },
    ],
  } as ShowcaseVariantDto;
}

const VARIANTS = [
  variant('r44', 'Красный', '44'), variant('r46', 'Красный', '46'), variant('r48', 'Красный', '48'),
  variant('b44', 'Синий', '44'), variant('b46', 'Синий', '46'),
];

describe('размеры одного цвета', () => {
  it('размеры — только того же цвета, в порядке оси', () => {
    expect(sizeRowsOf(VARIANTS, VARIANTS[0]).map((row) => row.variant.itemId)).toEqual(['r44', 'r46', 'r48']);
    expect(sizeRowsOf(VARIANTS, VARIANTS[3]).map((row) => row.variant.itemId)).toEqual(['b44', 'b46']);
  });
});
