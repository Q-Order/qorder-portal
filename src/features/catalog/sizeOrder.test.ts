import { describe, expect, it } from 'vitest';
import { bySize } from './VariantPicker';

describe('размеры по росту', () => {
  it('числа — по значению', () => {
    expect(['44', '50', '46', '42', '56'].sort(bySize)).toEqual(['42', '44', '46', '50', '56']);
  });

  it('буквы — по шкале, 2XL = XXL', () => {
    expect(['S', 'M', 'L', 'XS', 'XXL', 'XL', '3XL', 'XXS'].sort(bySize)).toEqual(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']);
    expect(['4XL', 'XL', '2XL', 'M'].sort(bySize)).toEqual(['M', 'XL', '2XL', '4XL']);
  });

  it('непонятное — где было', () => {
    expect(['Б', 'А', 'В'].sort(bySize)).toEqual(['Б', 'А', 'В']);
  });
});
