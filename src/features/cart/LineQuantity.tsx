import { useTranslation } from 'react-i18next';
import { cartOf, useCart } from './useCart';
import { useWholesaleLines } from './useCart';
import { lineGroupOf } from './cartPart';
import { cn } from '../../ui/cn';

/**
 * Количество одежды оптом — линейками (решение владельца 2026-11-14): «−» и «+» убирают и добавляют
 * целую линейку размеров; меньше первой ступени — линейка уходит из корзины целиком.
 * `maxLines` — полных линеек в наличии (по самому скудному размеру): больше «+» не даёт;
 * не передан — берётся из взятой линейки корзины (плитка каталога своего остатка линеек не знает).
 */
export function LineQuantity({ itemId, minLines = 1, maxLines, className }: {
  itemId: string; minLines?: number; maxLines?: number | null; className?: string;
}) {
  const { t } = useTranslation();
  const cart = cartOf(useCart().data);
  const setLines = useWholesaleLines();
  const held = lineGroupOf(cart, itemId);
  const lines = held?.lines ?? 0;
  const max = maxLines ?? held?.availableLines;
  const set = (next: number) => setLines.mutate({ itemId, data: { lines: next < minLines ? 0 : next } });
  const button = cn(
    'flex size-10 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*13/14)] bg-surface text-accent-ink',
    'shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-all duration-200 hover:bg-sunk active:scale-95',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40',
  );
  return (
    <div data-testid="line-quantity"
      className={cn('flex h-13 w-full items-center justify-between gap-1 rounded-[var(--radius-tile)] bg-accent-soft p-1', className)}>
      <button type="button" aria-label={t('cart.lines.less')} className={button}
        disabled={lines <= 0 || setLines.isPending} onClick={() => set(lines - 1)}>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4"><path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <span className="flex flex-col items-center leading-none" aria-live="polite">
        <b className="text-lead font-extrabold tabular-nums text-accent-ink">{lines}</b>
        <span className="text-2xs font-semibold text-accent-ink">{t('cart.lines.unit', { count: lines })}</span>
      </span>
      <button type="button" aria-label={t('cart.lines.more')} className={button}
        disabled={setLines.isPending || (max != null && lines >= max)} onClick={() => set(Math.max(lines + 1, minLines))}>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4"><path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
