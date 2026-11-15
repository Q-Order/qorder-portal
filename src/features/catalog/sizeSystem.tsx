import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SizeChartDto } from '../../api/generated';
import { cn } from '../../ui/cn';
import { standardSize, type SizeGrid } from './sizeStandard';

/**
 * В какой системе подписывать размеры одежды: RUS — как завёл продавец, INT — буквы («M/L»),
 * EUR — строка мерок EUR его таблицы (как у Спортмастера, просьба владельца 2026-11-14).
 */
export type SizeSystem = 'RUS' | 'INT' | 'EUR';

const KEY = 'qo.sizeSystem';

/** Системы, которые есть в таблице продавца; RUS — всегда. Одна система — переключать нечего. */
export function systemsOf(chart: SizeChartDto | undefined): SizeSystem[] {
  if (!chart) return ['RUS'];
  const systems: SizeSystem[] = ['RUS'];
  if (chart.sizes.some((size) => size.intl)) systems.push('INT');
  if (chart.rows.some((row) => row.measure === 'EUR' && Object.keys(row.values ?? {}).length > 0)) systems.push('EUR');
  return systems;
}

/** Подпись размера `label` (как его завёл продавец) в системе `system`; нет значения — прежняя подпись. */
export function sizeIn(chart: SizeChartDto | undefined, label: string, system: SizeSystem): string {
  if (!chart || system === 'RUS') return label;
  const size = chart.sizes.find((one) => one.label === label);
  if (!size) return label;
  if (system === 'INT') return size.intl || label;
  const eur = chart.rows.find((row) => row.measure === 'EUR')?.values?.[size.code];
  return eur || label;
}

/**
 * Размер в трёх системах (линейка в «Оптом», выбор в «В розницу»): заполненное продавцом в таблице размеров — главнее, пустое —
 * по стандартной сетке модели (решение владельца 2026-11-14). Размер, заведённый буквой, в RUS — числом.
 */
export function sizeRow(label: string, chart: SizeChartDto | undefined, grid: SizeGrid | undefined): Record<SizeSystem, string | undefined> {
  const standard = standardSize(label, grid);
  const own = (system: SizeSystem) => {
    const value = sizeIn(chart, label, system);
    return value === label ? undefined : value;
  };
  return {
    RUS: /\d/.test(label) ? label : standard?.rus ?? label,
    INT: own('INT') ?? standard?.intl ?? (/\d/.test(label) ? undefined : label),
    EUR: own('EUR') ?? standard?.eur,
  };
}

function stored(): SizeSystem {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'INT' || value === 'EUR' ? value : 'RUS';
  } catch {
    return 'RUS';
  }
}

/** Выбранная система, помнится на устройстве; системы, которой нет в таблице, — RUS. */
export function useSizeSystem(chart: SizeChartDto | undefined): [SizeSystem, (next: SizeSystem) => void, SizeSystem[]] {
  const [system, setSystem] = useState<SizeSystem>(stored);
  const systems = systemsOf(chart);
  const set = (next: SizeSystem) => {
    setSystem(next);
    try { localStorage.setItem(KEY, next); } catch { /* без хранилища — до перезагрузки */ }
  };
  return [systems.includes(system) ? system : 'RUS', set, systems];
}

/** «RUS · INT · EUR» — выбор системы подписей размеров; одна система — переключателя нет. */
export function SizeSystemSwitch({ value, systems, onChange }: {
  value: SizeSystem; systems: SizeSystem[]; onChange: (next: SizeSystem) => void;
}) {
  const { t } = useTranslation();
  if (systems.length < 2) return null;
  return (
    <span role="radiogroup" aria-label={t('item.sizeSystem')} className="inline-flex items-center gap-1">
      {systems.map((system) => (
        <button key={system} type="button" role="radio" aria-checked={system === value} onClick={() => onChange(system)}
          className={cn(
            'min-h-8 rounded-[var(--radius-small)] px-2 text-sm font-bold transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            system === value ? 'text-accent-ink' : 'text-ink-muted hover:text-ink',
          )}>
          {system}
        </button>
      ))}
    </span>
  );
}
