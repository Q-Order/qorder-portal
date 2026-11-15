import { useTranslation } from 'react-i18next';
import type { SnapshotLineDto } from '../../api/generated';
import type { Currency } from '../../shared/currency';
import { money } from '../../shared/format';
import { cn } from '../../ui/cn';
import { LinkedLineThumb } from '../cart/LineThumb';
import { PackContents } from '../catalog/PackContents';

/** Строка заявки, как её видит клиент: размеры одной линейки одежды (общий `lineKey`) — одна строка. */
export type OrderRow =
  | { kind: 'one'; line: SnapshotLineDto; index: number }
  | { kind: 'line'; key: string; rows: SnapshotLineDto[] };

export function orderRows(lines: SnapshotLineDto[]): OrderRow[] {
  const rows: OrderRow[] = [];
  const groups = new Map<string, SnapshotLineDto[]>();
  lines.forEach((line, index) => {
    if (!line.lineKey) { rows.push({ kind: 'one', line, index }); return; }
    const group = groups.get(line.lineKey);
    if (group) { group.push(line); return; }
    const fresh = [line];
    groups.set(line.lineKey, fresh);
    rows.push({ kind: 'line', key: line.lineKey, rows: fresh });
  });
  return rows;
}


/**
 * Название линейки и подписи размеров. У всех строк линейки имя одно — название модели («Пиджак»),
 * чем они различаются, говорит подпись варианта («Чёрный · 48»): её общие части (цвет) — в название,
 * свои — подписью размера. Замена цвета внутри линейки («Мокко · 56») оставляет цвет у размера.
 */
export function lineTitle(rows: SnapshotLineDto[]): { title: string; labels: string[] } {
  const parts = rows.map((row) => row.variantLabel?.split(' · ') ?? []);
  const common = (parts[0] ?? []).filter((part) => parts.every((own) => own.includes(part)));
  const name = rows[0]?.name ?? '';
  const title = [name, ...(rows.length > 1 ? common : [])].join(' · ');
  const labels = parts.map((own, index) => {
    const label = own.filter((part) => rows.length === 1 || !common.includes(part)).join(' · ');
    // Подписи варианта нет (заявка до неё) — размер не узнать, остаётся имя строки.
    return label || rows[index].name;
  });
  return { title, labels };
}

/**
 * Линейка в заявке — одной строкой «Куртка AZA01 чёрная · 2 линейки» (решение владельца 2026-11-14):
 * количество и цена штуки, состав по нажатию, «линейка изменена», если продавец поменял размеры.
 */
export function OrderLineGroup({ rows, currency, offered = false }: {
  rows: SnapshotLineDto[];
  currency: Currency | undefined;
  /** Продавец предложил замену в этой линейке — строка с оттенком, как прочие предложенные. */
  offered?: boolean;
}) {
  const { t } = useTranslation();
  const head = rows[0];
  const { title, labels } = lineTitle(rows);
  const pieces = rows.reduce((sum, row) => sum + row.quantity, 0);
  const amount = rows.reduce((sum, row) => sum + (row.amount ?? (row.price ?? 0) * row.quantity), 0);
  const changed = rows.some((row) => row.lineChanged);
  const members = rows.map((row, index) => ({ key: `${index}`, name: labels[index], quantity: row.quantity, unit: row.unit }));
  return (
    <li data-testid="order-line" data-line={head.lineKey} data-offered={offered ? 'LINE' : undefined}
      className={cn('flex items-center gap-3 py-2.5 text-sm',
        offered && '-mx-2 my-0.5 rounded-[var(--radius-control)] border-0 bg-accent-soft px-2')}>
      <LinkedLineThumb itemId={head.itemId} seed={head.itemId ?? head.name} src={head.imageUrl}
        label={t('orders.openItem', { name: title })} className="size-11" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-ink">
          {title} · {t('cart.lines.unitCount', { count: head.lines ?? 1 })}
        </span>
        {changed ? (
          <span data-testid="order-line-changed"
            className="self-start rounded-full bg-sale-soft px-2 py-0.5 text-xs font-extrabold text-sale-ink">
            {t('cart.lineRow.changed')}
          </span>
        ) : null}
        <span className="tabular-nums text-ink-muted">
          {head.price === undefined
            ? t('orders.lineRow.pieces', { pieces })
            : t('orders.lineRow.piecesAt', { pieces, price: money(head.price, currency) })}
        </span>
        <PackContents label={t('cart.lineRow.inside')} members={members} />
      </span>
      <b className="shrink-0 whitespace-nowrap font-bold tabular-nums text-ink">{money(amount, currency)}</b>
    </li>
  );
}
