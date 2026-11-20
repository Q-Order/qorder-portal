import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ShowcaseItemDto } from '../../api/generated';
import { axesOf, swatchOf, pickVariant, swatchesOf, valuesOf, type Axis } from './VariantPicker';
import { cn } from '../../ui/cn';
import { useOrderMode } from '../cart/orderMode';
import { variantsIn } from './itemParts';

/** Сколько значений показать, пока ширину плитки не измерить. */
const VISIBLE = 5;
/** Зазор между кнопками значений — `gap-1`. */
const GAP = 4;
const CHIP = 'h-9 min-w-9 rounded-[var(--radius-control)] border px-2 text-caption font-semibold sm:h-8';
const SWATCH = 'size-9 sm:size-8';

/**
 * Какие значения показать в одну строку: все — если влезают, иначе первые по порядку и выбранное,
 * столько, чтобы рядом встал «+N». Ряд в одну строку, а не с переносом: перенесённое одно
 * значение или «+N» висело сиротой. `widths` — ширины значений по порядку `options`.
 */
export function shownOptions(options: string[], widths: number[], more: number, room: number, chosen?: string): string[] {
  const width = (list: string[]) => list.reduce((sum, option, index) => sum + widths[options.indexOf(option)] + (index ? GAP : 0), 0);
  if (width(options) <= room) return options;
  const pinned = chosen !== undefined && options.includes(chosen) ? chosen : undefined;
  for (let count = options.length - 1; count > 1; count -= 1) {
    let list = options.slice(0, count);
    if (pinned && !list.includes(pinned)) list = [...options.slice(0, count - 1), pinned];
    if (width(list) + GAP + more <= room) return list;
  }
  return [pinned ?? options[0]];
}

/**
 * Выбор варианта прямо на плитке витрины — макет «Каталог v1».
 *
 * Вариант — отдельная позиция продавца с тем же названием и разделом, и
 * плитка, выбрав его, становится плиткой этой позиции: её цена, наличие
 * и свободный остаток,
 * её строка в корзине и её карточка по ссылке. Снимок, сердечко и метки
 * условий остаются от показанной позиции: у варианта их в ответе витрины нет,
 * а выдумывать их нельзя. Старая цена и скидка распродажи — свои у каждого
 * варианта (продавец ставит в распродажу позицию, а не название): у выбранного
 * варианта показываются его собственные.
 *
 * Выбор — по одной оси, той, что первая у карточки товара (`axesOf`): цвет,
 * если он различается, иначе размер или фасовка. Две строки выбора на плитке
 * шириной в полтелефона не помещаются; остальное выбирают в карточке.
 *
 * Цвет — особый случай (решение владельца 2026-11-15): каждый цвет модели стоит в каталоге своей плиткой,
 * поэтому кружок другого цвета не переключает плитку (вышли бы две одинаковые), а открывает карточку
 * этого цвета. `colourName` — цвет самой плитки, его дописывают к названию.
 */
export function useTileVariant(item: ShowcaseItemDto) {
  const navigate = useNavigate();
  const [chosenId, setChosenId] = useState(item.id);
  // Цвета только выбранной заявки: в «Оптом» нет розничных, в «В розницу» — оптовых (2026-11-20).
  const variants = variantsIn(item, useOrderMode()[0]).variants ?? [];
  const axes = variants.length >= 2 ? axesOf(variants) : [];
  const axis = axes[0] as Axis | undefined;
  const chosen = variants.find((variant) => variant.itemId === chosenId)
    ?? variants.find((variant) => variant.itemId === item.id);

  const shown: ShowcaseItemDto = !chosen || chosen.itemId === item.id
    ? item
    : {
      ...item,
      id: chosen.itemId,
      price: chosen.price,
      stock: chosen.stock,
      oldPrice: chosen.oldPrice,
      discountPercent: chosen.discountPercent,
      // Свободный остаток — свой у варианта: «Свободно: N», ноль — серым,
      // пусто — остаток у позиции не ведётся. Артикула про вариант ответ
      // витрины не несёт.
      available: chosen.available,
      sku: undefined,
    };

  const choice = axis && chosen ? (
    <TileVariantChoice
      axis={axis}
      chosen={valuesOf(chosen).get(axis.code)?.text}
      cardId={shown.id}
      jumps={axis.colour}
      onPick={(option) => {
        const best = pickVariant(variants, axes, chosen, axis, option);
        if (!best) return;
        if (axis.colour) navigate(`/catalog/${best.itemId}`);
        else setChosenId(best.itemId);
      }}
    />
  ) : null;
  const colourAxis = axes.find((one) => one.colour);
  const colourName = colourAxis && chosen ? valuesOf(chosen).get(colourAxis.code)?.text : undefined;

  // Выбор цвета уже показывает цвета — метка «4 цвета» на фото его бы повторяла.
  return { shown, choice, colour: !!axis?.colour, colourName };
}

/**
 * Кружки цветов или кнопки значений — группой переключателей: выбран всегда
 * ровно один, и экранный диктор так и читает — «Цвет, белый, выбран, 1 из 2».
 * Стрелки ходят по значениям, в группу Tab попадает один раз.
 *
 * Цель касания — 36 точек даже у кружка: сам кружок меньше, а вокруг него
 * прозрачное поле. На узкой плитке ряд переносится, а не вылезает за край.
 */
function TileVariantChoice({
  axis,
  chosen,
  cardId,
  jumps = false,
  onPick,
}: {
  axis: Axis;
  chosen: string | undefined;
  cardId: string;
  /** Выбор уводит в карточку (цвет): стрелки только переводят фокус, выбор — Enter или нажатием. */
  jumps?: boolean;
  onPick: (option: string) => void;
}) {
  const { t } = useTranslation();
  const group = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const swatches = swatchesOf(axis);
  // Сколько влезает — мерят невидимые копии всех кнопок: ширина плитки на телефоне и мониторе разная.
  const [measured, setMeasured] = useState<{ widths: number[]; more: number; room: number } | null>(null);
  // Оси пересобираются на каждой отрисовке — мерить заново только при других значениях.
  const optionsKey = axis.options.join('\n');
  useLayoutEffect(() => {
    const row = box.current;
    const marks = ruler.current;
    if (!row || !marks) return;
    const measure = () => {
      const widths = [...marks.children].map((chip) => (chip as HTMLElement).offsetWidth);
      const more = widths.pop() ?? 0;
      // Без раскладки (ширина 0 — плитка скрыта, тесты) — прежнее правило: пять и «+N».
      setMeasured(row.clientWidth > 0 ? { widths, more, room: row.clientWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [optionsKey, swatches]);
  // Выбранное значение видно всегда, даже когда по порядку оно за «+N».
  let visible = measured
    ? shownOptions(axis.options, measured.widths, measured.more, measured.room, chosen)
    : axis.options.slice(0, VISIBLE);
  if (!measured && chosen && !visible.includes(chosen)) visible = [...visible.slice(0, VISIBLE - 1), chosen];
  const hidden = axis.options.length - visible.length;

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + visible.length) % visible.length;
    if (!jumps) onPick(visible[next]);
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }

  return (
    // «+N» — в том же ряду, что и значения, и такой же кнопкой: отдельной строкой он висел сиротой.
    <div ref={box} className="relative flex items-center gap-1">
      <div ref={ruler} aria-hidden="true" className="invisible absolute left-0 top-0 flex h-0 w-0 gap-1 overflow-hidden whitespace-nowrap">
        {axis.options.map((option) => (
          <span key={option} className={cn('flex shrink-0 items-center', swatches ? SWATCH : CHIP)}>{swatches ? null : option}</span>
        ))}
        <span className={cn('flex shrink-0 items-center', CHIP)}>+{axis.options.length}</span>
      </div>
      <div ref={group} role="radiogroup" aria-label={axis.name} className="contents">
        {visible.map((option, index) => {
          const on = option === chosen;
          const label = t('item.variantOption', { name: axis.name, value: option });
          return swatches ? (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              title={option}
              tabIndex={on ? 0 : -1}
              onClick={() => onPick(option)}
              onKeyDown={(event) => move(event, index)}
              className={cn('group/swatch flex shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', SWATCH)}
            >
              <span
                aria-hidden="true"
                style={{ background: swatchOf(axis, option) }}
                className={cn(
                  'size-6 rounded-full border-2 border-surface transition-shadow duration-150',
                  on ? 'shadow-[0_0_0_2px_var(--color-accent)]' : 'shadow-[0_0_0_1px_var(--color-line)] group-hover/swatch:shadow-[0_0_0_1.5px_var(--color-ink-muted)]',
                )}
              />
            </button>
          ) : (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              tabIndex={on ? 0 : -1}
              onClick={() => onPick(option)}
              onKeyDown={(event) => move(event, index)}
              className={cn(
                CHIP, 'shrink-0 cursor-pointer transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:border-ink/50',
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {hidden > 0 && (
        <Link
          to={`/catalog/${cardId}`}
          aria-label={t('catalog.variantsMore', { count: hidden })}
          className={cn(
            CHIP, 'flex shrink-0 items-center justify-center border-dashed border-line text-ink-muted hover:border-accent hover:text-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          +{hidden}
        </Link>
      )}
    </div>
  );
}
