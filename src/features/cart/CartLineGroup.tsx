import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X } from '../../ui/icons';
import type { CartLineDto } from '../../api/generated';
import type { Currency } from '../../shared/currency';
import { money } from '../../shared/format';
import { cn } from '../../ui/cn';
import { PackContents } from '../catalog/PackContents';
import { closeCart } from './cartDrawer';
import { LineQuantity } from './LineQuantity';
import { LineThumb } from './LineThumb';

/** Подпись линейки: название, цвет без размера и ряд «48–58». */
export function lineGroupTitle(head: CartLineDto): { name: string; colour?: string; range: string } {
  const sizes = head.line!.sizes;
  const range = sizes.length > 1 ? `${sizes[0].label}–${sizes[sizes.length - 1].label}` : sizes[0]?.label ?? '';
  // Вариант строки — «Чёрный · 48»: размер у линейки свой у каждой строки, остаётся цвет.
  const own = new Set(sizes.map((size) => size.label));
  const colour = head.variantLabel?.split(' · ').filter((part) => !own.has(part)).join(' · ') || undefined;
  return { name: head.name, colour, range };
}

function members(head: CartLineDto) {
  return head.line!.sizes.map((size) => ({ key: size.itemId, name: size.label, quantity: size.quantity, unit: head.unit }));
}

const total = (rows: CartLineDto[]) => rows.reduce((sum, row) => sum + (row.total ?? 0), 0);

/**
 * Линейка одежды в корзине — одной строкой (решение владельца 2026-11-14): крупно цена штуки,
 * мелко цена линейки, состав по нажатию, «−/+» — целыми линейками. Сервер хранит её строками
 * размеров (артикулы нужны складу, счёту и 1С), клиент видит одну вещь.
 */
export function LineGroupRow({ rows, currency, picked, onPick, onRemove, removing }: {
  rows: CartLineDto[];
  currency: Currency | undefined;
  picked: boolean;
  onPick: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const { t } = useTranslation();
  const head = rows[0];
  const line = head.line!;
  const { name, colour, range } = lineGroupTitle(head);
  const label = t('cart.lineRow.title', { name, range });
  return (
    <div data-testid="cart-line" data-line={line.key} className="border-b border-hairline last:border-b-0">
      <div className={cn('flex gap-3.5 py-4 transition-opacity duration-150', !picked && 'opacity-55')}>
        <input type="checkbox" aria-label={t('cart.pickLine', { name: label })}
          className="mt-7 size-5 shrink-0 cursor-pointer accent-[var(--color-accent)]"
          checked={picked} onChange={onPick} />
        <Link to={`/catalog/${encodeURIComponent(head.itemId)}`} onClick={closeCart} tabIndex={-1} aria-hidden="true" className="shrink-0">
          <LineThumb seed={head.itemId} src={head.imageUrl} className="h-[4.75rem] w-16 rounded-[var(--radius-control)]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-body font-semibold leading-[1.3] text-ink">
              <Link to={`/catalog/${encodeURIComponent(head.itemId)}`} onClick={closeCart}
                className="rounded-[4px] text-inherit no-underline hover:text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {label}
              </Link>
              {colour ? <span className="block text-caption font-medium text-ink-muted">{colour}</span> : null}
            </p>
            <button type="button" aria-label={t('cart.removeLine', { name: label })} disabled={removing} onClick={onRemove}
              className={cn(
                '-mr-3 -mt-3 flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-small)] text-ink-faint',
                'transition-colors duration-200 hover:bg-ink/5 hover:text-ink',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
              )}>
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span data-testid="cart-line-mode" className="rounded-full bg-wholesale-soft px-2.5 py-0.5 text-caption font-bold text-wholesale-ink">
              {t('cart.mode.WHOLESALE')}
            </span>
          </div>
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-caption">
            <b className="text-body font-extrabold tabular-nums text-ink">{t('cart.lineRow.piece', { price: money(line.piecePrice, currency) })}</b>
          </p>
          <PackContents label={t('cart.lineRow.inside')} members={members(head)} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <LineQuantity itemId={head.itemId} maxLines={line.availableLines} className="w-auto min-w-40" />
            <p data-testid="line-total" className="shrink-0 text-base font-extrabold tabular-nums text-ink">{money(total(rows), currency)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Линейка в сводке оформления — коротко: «2 линейки · 12 шт × цена штуки», состав по нажатию. */
export function LineGroupSummary({ rows, currency }: { rows: CartLineDto[]; currency: Currency | undefined }) {
  const { t } = useTranslation();
  const head = rows[0];
  const line = head.line!;
  const { name, colour, range } = lineGroupTitle(head);
  const pieces = rows.reduce((sum, row) => sum + row.quantity, 0);
  return (
    <div data-testid="cart-line" data-line={line.key} className="flex items-center gap-3 border-b border-hairline py-3 last:border-b-0">
      <LineThumb seed={head.itemId} src={head.imageUrl} className="size-12 shrink-0" />
      <div className="min-w-0 flex-1 break-words">
        <p className="text-body font-semibold leading-[1.3] text-ink">
          {t('cart.lineRow.title', { name, range })}{colour ? <span className="font-medium text-ink-muted"> · {colour}</span> : null}
        </p>
        <p className="m-0 text-caption text-ink-muted">
          {t('cart.lineRow.summary', { lines: t('cart.lines.unitCount', { count: line.lines }), pieces, price: money(line.piecePrice, currency) })}
        </p>
        <PackContents label={t('cart.lineRow.inside')} members={members(head)} />
      </div>
      <p data-testid="line-total" className="shrink-0 text-body font-bold tabular-nums text-ink">{money(total(rows), currency)}</p>
    </div>
  );
}
