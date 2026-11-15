import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../i18n';
import { SizeChartTable } from './SizeChartTable';

/** Таблица размеров модели: строки — размеры, столбцы — INT и мерки; ни один размер не выделен (просьба владельца 2026-11-14). */
describe('SizeChartTable', () => {
  it('показывает мерки по размерам; открытый размер не выделяется', () => {
    render(<SizeChartTable chart={{
      current: 'RU50',
      sizes: [{ code: 'RU48', label: '48', intl: 'M/L' }, { code: 'RU50', label: '50', intl: 'L/XL' }],
      rows: [{ measure: 'CHEST', values: { RU48: '96', RU50: '100' } },
        { measure: 'CUSTOM', label: 'Длина рукава', values: { RU48: '62' } }],
    }} />);

    expect(screen.getByRole('columnheader', { name: 'Обхват груди, см' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Длина рукава' })).toBeInTheDocument();
    expect(screen.queryByRole('row', { current: true } as never)).not.toBeInTheDocument();
    const row = screen.getByRole('row', { name: /^50/ });
    expect(row).not.toHaveClass('bg-accent-soft');
    expect(row).toHaveTextContent('L/XL');
    expect(row).toHaveTextContent('100');
    expect(row).toHaveTextContent('—');
  });

  afterEach(() => vi.restoreAllMocks());
  const CHART = { current: 'M', sizes: [{ code: 'M', label: 'M' }], rows: [{ measure: 'CHEST' as const, values: { M: '96' } }] };

  it('«листайте вбок» — только когда таблица шире окна', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    const { unmount } = render(<SizeChartTable chart={CHART} />);
    expect(screen.queryByText('Листайте таблицу вбок →')).not.toBeInTheDocument();
    unmount();

    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(900);
    render(<SizeChartTable chart={CHART} />);
    expect(screen.getByText('Листайте таблицу вбок →')).toBeInTheDocument();
  });

  // По сетке модели — как таблица выбора в карточке: мужское M — RUS 48, INT M (2026-11-15).
  it('с сеткой модели буквенный размер в RUS — числом, INT — буквой', () => {
    render(<SizeChartTable grid="MEN" chart={{ current: 'M', sizes: [{ code: 'M', label: 'M', intl: 'M' }],
      rows: [{ measure: 'CHEST', values: { M: '96' } }] }} />);
    const row = screen.getByRole('row', { name: /^48/ });
    expect(row).toHaveTextContent('M');
    expect(screen.getByRole('columnheader', { name: 'INT' })).toBeInTheDocument();
  });
});
