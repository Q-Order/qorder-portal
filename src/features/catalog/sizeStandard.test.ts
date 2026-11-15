import { describe, expect, it } from 'vitest';
import { standardSize } from './sizeStandard';

describe('стандартные размеры RUS / INT / EUR', () => {
  it('женская сетка: EUR = RUS − 6; буква с двумя размерами — диапазоном', () => {
    expect(standardSize('48', 'WOMEN')).toEqual({ rus: '48', intl: 'L', eur: '42' });
    expect(standardSize('XS', 'WOMEN')).toEqual({ rus: '40', intl: 'XS', eur: '34' });
    expect(standardSize('M', 'WOMEN')).toEqual({ rus: '44–46', intl: 'M', eur: '38–40' });
  });

  it('мужская и унисекс: EUR = RUS', () => {
    expect(standardSize('48', 'MEN')).toEqual({ rus: '48', intl: 'M', eur: '48' });
    expect(standardSize('XL', 'UNISEX')).toEqual({ rus: '52', intl: 'XL', eur: '52' });
    expect(standardSize('2XL', 'MEN')).toEqual({ rus: '54', intl: 'XXL', eur: '54' });
  });

  it('диапазоны продавца «40-42», «S-M» и «48#» понимаются', () => {
    expect(standardSize('40-42', 'WOMEN')).toEqual({ rus: '40–42', intl: 'XS–S', eur: '34–36' });
    expect(standardSize('S-M', 'MEN')).toEqual({ rus: '46–48', intl: 'S–M', eur: '46–48' });
    expect(standardSize('48#', 'MEN')?.intl).toBe('M');
  });

  it('сетка не выбрана или размер не из таблицы — ничего не подставляется', () => {
    expect(standardSize('48', undefined)).toBeUndefined();
    expect(standardSize('Единый', 'WOMEN')).toBeUndefined();
    expect(standardSize('128', 'MEN')).toBeUndefined();
  });
});
