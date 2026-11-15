import { describe, expect, it } from 'vitest';
import type { SizeChartDto } from '../../api/generated';
import { sizeIn, systemsOf } from './sizeSystem';

const CHART = {
  sizes: [{ code: 'RU48', label: '48', intl: 'M' }, { code: 'RU50', label: '50' }],
  rows: [{ measure: 'EUR', values: { RU48: '42' } }, { measure: 'CHEST', values: { RU48: '96' } }],
} as unknown as SizeChartDto;

describe('системы размеров', () => {
  it('RUS есть всегда; INT и EUR — только если продавец их заполнил', () => {
    expect(systemsOf(undefined)).toEqual(['RUS']);
    expect(systemsOf(CHART)).toEqual(['RUS', 'INT', 'EUR']);
    expect(systemsOf({ sizes: [{ code: 'RU48', label: '48' }], rows: [] } as unknown as SizeChartDto)).toEqual(['RUS']);
  });

  it('подпись в системе — из таблицы продавца; нет значения — прежняя подпись', () => {
    expect(sizeIn(CHART, '48', 'INT')).toBe('M');
    expect(sizeIn(CHART, '48', 'EUR')).toBe('42');
    expect(sizeIn(CHART, '50', 'INT')).toBe('50');
    expect(sizeIn(CHART, '48', 'RUS')).toBe('48');
    expect(sizeIn(undefined, '48', 'EUR')).toBe('48');
  });
});
