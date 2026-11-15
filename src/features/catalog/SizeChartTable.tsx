import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SizeChartDto } from '../../api/generated';
import { cn } from '../../ui/cn';
import { sizeRow } from './sizeSystem';
import type { SizeGrid } from './sizeStandard';

/**
 * Таблица размеров модели от продавца (решение владельца 2026-11-14, образец — Спортмастер):
 * строки — размеры (RUS), столбцы — INT и мерки.
 * На телефоне листается вбок, столбец размера закреплён.
 */
export function SizeChartTable({ chart, grid }: { chart: SizeChartDto; grid?: SizeGrid }) {
  const { t } = useTranslation();
  // RUS и INT — тем же правилом, что таблица выбора размера в карточке (`sizeRow` по сетке модели):
  // иначе на странице «48», а в окне у того же размера «M» (QA планшета 2026-11-15).
  const rows = new Map(chart.sizes.map((size) => [size.code, sizeRow(size.label, chart, grid)]));
  const withIntl = [...rows.values()].some((row) => row.INT && row.INT !== row.RUS);
  const cell = 'whitespace-nowrap px-3 py-2 text-center';
  // Закреплённый столбец размера — с чертой справа: под ним уезжают INT и EUR, и без черты
  // их обрезки торчали рядом с «S», «M» (QA телефона 2026-11-14). Рамка таблицы с `sticky` не едет — тень едет.
  const pinned = 'sticky left-0 shadow-[inset_-1px_0_0_var(--color-hairline)]';
  // Заголовок мерки переносится в две строки: «Обхват бёдер, см» — иначе на мониторе таблица уходила вбок.
  const head = 'px-2.5 py-2 text-center align-bottom leading-tight';
  // Подсказка «листайте вбок» — только когда таблица правда шире окна: на планшете она
  // помещалась целиком, а подсказка звала листать (QA 2026-11-14).
  const scroller = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return undefined;
    const check = () => setOverflows(node.scrollWidth > node.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(node);
    return () => observer.disconnect();
  }, [chart]);
  return (
    <div className="flex shrink-0 flex-col gap-1">
    {overflows ? <p className="m-0 text-caption text-ink-muted">{t('item.sizeChart.scroll')}</p> : null}
    <div ref={scroller} className="-mx-1 shrink-0 overflow-x-auto" data-testid="size-chart">
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr className="bg-sunk text-ink">
            <th scope="col" className={cn(cell, pinned, 'bg-sunk align-bottom font-extrabold')}>{t('item.sizeChart.rus')}</th>
            {withIntl ? <th scope="col" className={cn(head, 'font-bold')}>{t('item.sizeChart.intl')}</th> : null}
            {chart.rows.map((row, index) => (
              <th key={index} scope="col" className={cn(head, 'min-w-20 font-bold')}>
                {row.measure === 'CUSTOM' ? row.label : t(`item.sizeChart.measures.${row.measure}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Без выделения размера: оптом берут линейку целиком, подсвеченный размер путал (просьба владельца 2026-11-14). */}
          {chart.sizes.map((size) => (
            <tr key={size.code} className="border-b border-hairline text-ink">
              <th scope="row" className={cn(cell, pinned, 'bg-surface font-extrabold')}>{rows.get(size.code)?.RUS ?? size.label}</th>
              {withIntl ? <td className={cell}>{rows.get(size.code)?.INT ?? '—'}</td> : null}
              {chart.rows.map((row, index) => <td key={index} className={cell}>{row.values[size.code] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}
