import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalTemplatesQueryKey,
  getPortalTemplateLineOf,
  useGetPortalCatalog,
  useGetPortalTemplateLines,
  useUpdatePortalTemplate,
  type OrderTemplateDto,
  type ShowcaseItemDto,
  type SnapshotLineDto,
  type TemplateLineDto,
} from '../../api/generated';
import { quantityWithUnit } from '../../shared/units';
import { firstValid, quantityProblem } from './quantityRule';
import { rules } from '../../api/rules.generated';
import { Button } from '../../ui/Button';
import { lineTitle } from '../orders/OrderLineGroup';
import { cn } from '../../ui/cn';

const FIELD = 'h-11 w-full rounded-[var(--radius-control)] border-0 bg-sunk px-3 text-body text-ink focus:outline-none focus:ring-2 focus:ring-accent';

/** Строка шаблона на экране правки; у добавленного из каталога известен минимум заказа. */
type EditLine = TemplateLineDto;

/**
 * Правка шаблона прямо в его карточке: название, количество каждой позиции, «убрать»
 * и «найти и добавить товар» из каталога магазина.
 */
export function TemplateEditor({ template, onDone }: { template: OrderTemplateDto; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const response = useGetPortalTemplateLines(template.id);
  const loaded: TemplateLineDto[] | undefined = response.data?.status === 200 ? response.data.data : undefined;
  const [name, setName] = useState(template.name);
  // Правки поверх загруженного: количество строкой поля, убранные — отдельным списком.
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  // Линейка одежды правится числом линеек: штуки размеров = линеек × штук размера в линейке (2026-11-15).
  const [lineCounts, setLineCounts] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<EditLine[]>([]);
  const [query, setQuery] = useState('');
  const searching = query.trim().length >= 2;
  const found = useGetPortalCatalog({ query: query.trim(), size: 6 }, { query: { enabled: searching } });
  const results: ShowcaseItemDto[] = searching && found.data?.status === 200 ? found.data.data.items ?? [] : [];
  const update = useUpdatePortalTemplate({
    mutation: {
      onSuccess: (result) => {
        if (result.status !== 200) return;
        void queryClient.invalidateQueries({ queryKey: getGetPortalTemplatesQueryKey() });
        onDone();
      },
    },
  });

  if (!loaded) return <p className="m-0 text-sm text-ink-subtle">{t('templates.edit.loading')}</p>;
  const left: EditLine[] = [...loaded, ...added].filter((line) => !removed.includes(line.itemId));
  const has = (itemId: string) => left.some((line) => line.itemId === itemId);
  const groupOf = (key: string) => left.filter((line) => line.lineKey === key);
  const countOf = (key: string) => {
    const first = groupOf(key)[0];
    return lineCounts[key] ?? String(Math.max(1, Math.round(first.quantity / (first.lineQty ?? 1))));
  };
  const badCount = (key: string) => !/^[1-9]\d{0,3}$/.test(countOf(key).trim());
  const quantityOf = (line: EditLine) => (line.lineKey
    ? String(Number(countOf(line.lineKey)) * (line.lineQty ?? 1))
    : quantities[line.itemId] ?? String(line.quantity));
  const ruleOf = (line: EditLine) => ({ min: line.minQuantity, step: line.quantityStep });
  const bad = (line: EditLine) => (line.lineKey ? badCount(line.lineKey)
    : quantityProblem(Number(quantityOf(line).replace(',', '.')), ruleOf(line)) !== null);
  // Позиции экрана: размеры одной линейки — одна строка.
  const positions = left.filter((line, index) => !line.lineKey || left.findIndex((one) => one.lineKey === line.lineKey) === index);
  /** Подсказка о правиле товара: «не меньше 10 кг, по 10 кг» — её видно до ошибки, а не после. */
  const hintOf = (line: EditLine) => {
    const unit = line.unit ?? '';
    const min = line.minQuantity && line.minQuantity > 1 ? line.minQuantity : undefined;
    const step = line.quantityStep && line.quantityStep !== 1 ? line.quantityStep : undefined;
    if (min && step) return t('templates.edit.minStep', { min: quantityWithUnit(min, unit), step: quantityWithUnit(step, unit) });
    if (step) return t('templates.edit.step', { step: quantityWithUnit(step, unit) });
    if (min) return t('templates.edit.min', { amount: quantityWithUnit(min, unit) });
    return null;
  };
  const add = async (item: ShowcaseItemDto) => {
    // Одежда оптом — всей линейкой цвета (2026-11-15): сервер отдаёт её размеры строками шаблона.
    const line = await getPortalTemplateLineOf(item.id).catch(() => undefined);
    const sizes = line?.status === 200 ? line.data : [];
    if (sizes.length > 0) {
      const ids = sizes.map((size) => size.itemId);
      setRemoved((prev) => prev.filter((id) => !ids.includes(id)));
      setAdded((prev) => [...prev.filter((one) => !ids.includes(one.itemId)),
        ...sizes.filter((size) => !loaded.some((one) => one.itemId === size.itemId))]);
      setQuery('');
      return;
    }
    const rule = { min: item.terms?.minQuantity, step: item.terms?.quantityStep };
    setRemoved((prev) => prev.filter((id) => id !== item.id));
    if (!loaded.some((line) => line.itemId === item.id)) {
      setAdded((prev) => [...prev.filter((line) => line.itemId !== item.id),
        { itemId: item.id, name: item.name, unit: item.unit, quantity: firstValid(rule),
          minQuantity: rule.min, quantityStep: rule.step }]);
    }
    setQuery('');
  };
  const valid = name.trim() !== '' && left.length > 0 && !left.some(bad);
  const detail = (update.error as { info?: { detail?: unknown } } | null)?.info?.detail;

  return (
    <div data-testid="template-editor" className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">{t('templates.name')}</span>
        <input type="text" value={name} maxLength={rules.SaveTemplateRequest.name.maxLength}
          onChange={(event) => setName(event.currentTarget.value)} className={FIELD} />
      </label>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {positions.map((line) => (line.lineKey ? (
          <LineRow key={line.lineKey} rows={groupOf(line.lineKey)} count={countOf(line.lineKey)} bad={badCount(line.lineKey)}
            last={positions.length === 1}
            onCount={(text) => setLineCounts((prev) => ({ ...prev, [line.lineKey!]: text }))}
            onRemove={() => setRemoved((prev) => [...prev, ...groupOf(line.lineKey!).map((one) => one.itemId)])} />
        ) : (
          <li key={line.itemId} className="flex items-center gap-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body text-ink">{line.name ?? t('templates.edit.gone')}</span>
              {hintOf(line) ? (
                <span className={cn('text-caption', bad(line) ? 'text-gone' : 'text-ink-muted')}>{hintOf(line)}</span>
              ) : null}
            </span>
            <label className="flex items-center gap-1.5">
              <span className="sr-only">{t('templates.edit.quantity', { name: line.name ?? '' })}</span>
              <input type="text" inputMode="decimal" value={quantityOf(line)} aria-invalid={bad(line)}
                onChange={(event) => {
                  const text = event.currentTarget.value;
                  setQuantities((prev) => ({ ...prev, [line.itemId]: text }));
                }}
                className={cn(FIELD, 'w-20 text-right tabular-nums', bad(line) && 'ring-2 ring-gone')} />
              <span className="w-14 text-caption text-ink-muted">{line.unit ?? ''}</span>
            </label>
            <Button variant="outline" disabled={positions.length === 1}
              aria-label={t('templates.edit.removeAria', { name: line.name ?? '' })}
              onClick={() => setRemoved((prev) => [...prev, line.itemId])}>
              {t('templates.edit.remove')}
            </Button>
          </li>
        )))}
      </ul>
      {positions.length === 1 ? <p className="m-0 text-caption text-ink-muted">{t('templates.edit.lastLine')}</p> : null}
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t('templates.edit.addTitle')}</span>
          <input type="search" value={query} placeholder={t('templates.edit.addPlaceholder')}
            onChange={(event) => setQuery(event.currentTarget.value)} className={FIELD} />
        </label>
        {searching && found.isSuccess && results.length === 0 ? (
          <p className="m-0 text-caption text-ink-muted">{t('templates.edit.notFound')}</p>
        ) : null}
        {results.length > 0 ? (
          <ul data-testid="template-search" className="m-0 flex list-none flex-col gap-1 p-0">
            {results.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-[var(--radius-control)] bg-sunk px-3 py-2">
                <span className="min-w-0 flex-1 text-body text-ink">{item.name}</span>
                <Button variant="outline" disabled={has(item.id)}
                  aria-label={t('templates.edit.addAria', { name: item.name })} onClick={() => void add(item)}>
                  {has(item.id) ? t('templates.edit.inTemplate') : t('templates.edit.add')}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {update.isError ? (
        <p role="alert" className="m-0 text-sm text-gone">
          {typeof detail === 'string' && detail ? detail : t('templates.edit.failed')}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button className="flex-1" disabled={!valid || update.isPending}
          onClick={() => update.mutate({
            id: template.id,
            data: {
              name: name.trim(),
              lines: left.map((line) => ({ itemId: line.itemId, quantity: Number(quantityOf(line).replace(',', '.')) })),
            },
          })}>
          {update.isPending ? t('templates.saving') : t('templates.save')}
        </Button>
        <Button variant="outline" onClick={onDone}>{t('templates.auto.cancel')}</Button>
      </div>
    </div>
  );
}

/**
 * Линейка одежды в шаблоне — одной строкой: «Куртка AZA01 · Чёрный», ряд и штуки в линейке,
 * поле — число линеек. Размер по отдельности не правится и не убирается (2026-11-15).
 */
function LineRow({ rows, count, bad, last, onCount, onRemove }: {
  rows: EditLine[]; count: string; bad: boolean; last: boolean; onCount: (text: string) => void; onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { title, labels } = lineTitle(rows as unknown as SnapshotLineDto[]);
  const range = labels.length > 1 ? `${labels[0]}–${labels[labels.length - 1]}` : labels[0] ?? '';
  const pieces = rows.reduce((sum, row) => sum + (row.lineQty ?? 1), 0);
  return (
    <li data-testid="template-line" className="flex items-center gap-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body text-ink">{title}</span>
        <span className={cn('text-caption', bad ? 'text-gone' : 'text-ink-muted')}>
          {t('templates.edit.line', { range, pieces })}
        </span>
      </span>
      <label className="flex items-center gap-1.5">
        <span className="sr-only">{t('templates.edit.lines', { name: title })}</span>
        <input type="text" inputMode="numeric" value={count} aria-invalid={bad}
          onChange={(event) => onCount(event.currentTarget.value)}
          className={cn(FIELD, 'w-20 text-right tabular-nums', bad && 'ring-2 ring-gone')} />
        <span className="w-14 text-caption text-ink-muted">{t('cart.lines.unit', { count: Number(count) || 0 })}</span>
      </label>
      <Button variant="outline" disabled={last} aria-label={t('templates.edit.removeAria', { name: title })} onClick={onRemove}>
        {t('templates.edit.remove')}
      </Button>
    </li>
  );
}
