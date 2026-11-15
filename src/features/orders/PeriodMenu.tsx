import { useCallback, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, X } from '../../ui/icons';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { useDismiss } from '../../ui/useDismiss';
import { useWideScreen } from '../../ui/useWideScreen';
import { Sheet } from '../../ui/Sheet';
import { presetPeriod, type Period, type PeriodPreset } from './myOrdersModel';

const PRESETS: PeriodPreset[] = ['all', 'today', 'week', 'month', 'custom'];
const FIELD = 'h-11 w-full rounded-[var(--radius-control)] border-[1.5px] border-solid border-field-line bg-surface px-3 text-sm text-ink focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none';

/** «1 нояб. – 15 нояб.» — выбранный период словами на кнопке сброса. */
function periodLabel(period: Period, locale: string): string {
  const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  if (period.from && period.to) return period.from === period.to ? day(period.from) : `${day(period.from)} – ${day(period.to)}`;
  return period.from ? `≥ ${day(period.from)}` : `≤ ${day(period.to!)}`;
}

/**
 * Отбор «Моих заявок» по дате оформления (просьба владельца 2026-11-15): значок календаря рядом
 * с отборами открывает меню — готовые периоды или свои даты «с — по» и «Показать». Выбранный
 * период виден плашкой с крестиком, которая его сбрасывает.
 */
export function PeriodMenu({ value, onApply }: { value: Period; onApply: (period: Period) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [custom, setCustom] = useState<Period>(value);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  // Монитор — меню у значка; телефон — лист снизу: меню ушло бы под нижнюю панель (2026-11-15).
  const wide = useWideScreen();
  useDismiss(open && wide, close, box);
  const active = !!(value.from || value.to);
  const badRange = preset === 'custom' && (!custom.from && !custom.to || (!!custom.from && !!custom.to && custom.from > custom.to));

  const apply = () => {
    onApply(preset === 'custom' ? custom : presetPeriod(preset));
    setOpen(false);
  };

  const panel = (
    <>
      <div role="radiogroup" aria-label={t('orders.period.title')} className="flex flex-col gap-1">
        {PRESETS.map((key) => (
          <label key={key} className={cn(
            'flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 text-body',
            preset === key ? 'bg-accent-soft font-extrabold text-accent-ink' : 'text-ink hover:bg-sunk',
          )}>
            <input type="radio" name={`${menuId}-preset`} checked={preset === key} onChange={() => setPreset(key)}
              className="size-4 accent-[var(--color-shop)]" />
            {t(`orders.period.presets.${key}`)}
          </label>
        ))}
      </div>
      {preset === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            {t('orders.statement.from')}
            <input type="date" value={custom.from ?? ''} max={custom.to}
              onChange={(event) => setCustom({ ...custom, from: event.target.value || undefined })} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            {t('orders.statement.to')}
            <input type="date" value={custom.to ?? ''} min={custom.from}
              onChange={(event) => setCustom({ ...custom, to: event.target.value || undefined })} className={FIELD} />
          </label>
        </div>
      ) : null}
      <Button variant="accent" disabled={badRange} onClick={apply}>{t('orders.period.apply')}</Button>
    </>
  );

  return (
    <div ref={box} className="relative flex shrink-0 items-center gap-2">
      <button type="button" aria-label={t('orders.period.open')} aria-haspopup="dialog" aria-expanded={open}
        aria-controls={open ? menuId : undefined} onClick={() => setOpen((was) => !was)}
        className={cn(
          'relative flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-[3px] border-solid transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          active || open ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink hover:border-ink',
        )}>
        <CalendarDays className="size-6" />
      </button>
      {open && wide ? (
        <div id={menuId} role="dialog" aria-label={t('orders.period.title')}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-30 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[0_12px_32px_rgba(26,25,23,.18),0_0_0_1px_var(--color-hairline)]">
          <b className="text-body font-extrabold text-ink">{t('orders.period.title')}</b>
          {panel}
        </div>
      ) : null}
      {!wide ? (
        <Sheet open={open} onOpenChange={setOpen} title={t('orders.period.title')}>
          <div id={menuId} className="flex flex-col gap-3">{panel}</div>
        </Sheet>
      ) : null}
    </div>
  );
}

/** Выбранный период плашкой с крестиком: нажатие сбрасывает. Стоит после значков отбора, а не между ними. */
export function PeriodChip({ value, onReset }: { value: Period; onReset: () => void }) {
  const { t, i18n } = useTranslation();
  if (!value.from && !value.to) return null;
  const label = periodLabel(value, i18n.language);
  return (
    <button type="button" data-testid="period-chip" onClick={onReset} aria-label={t('orders.period.reset', { period: label })}
      className="inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-2xl border-[3px] border-solid border-shop bg-surface px-3 text-body font-extrabold text-ink hover:bg-sunk">
      {label}
      <X aria-hidden="true" className="size-4" />
    </button>
  );
}
