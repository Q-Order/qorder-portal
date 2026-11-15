import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ShowcaseVariantDto, SizeChartDto } from '../../api/generated';
import { SizeSystemSwitch, sizeIn, sizeRow, useSizeSystem, type SizeSystem } from './sizeSystem';
import type { SizeGrid } from './sizeStandard';
import { fieldText } from './fieldText';
import { cn } from '../../ui/cn';

/** Поле, по которому варианты отличаются: цвет, размер, объём… */
export interface Axis {
  code: string;
  name: string;
  colour: boolean;
  options: string[];
  /** Цвет кружка, заданный продавцом у варианта поля (#RRGGBB), — по подписи значения. */
  hexes?: Record<string, string>;
}

export const COLOUR = /цвет|түс|colou?r/i;
const SIZE = /размер|өлшем|size/i;

/**
 * Цвета по названию — для кружков выбора. Продавец пишет цвет словом,
 * а не кодом; неизвестное слово остаётся подписью, а не выдуманным цветом.
 */
const COLOURS: [RegExp, string][] = [
  [/тёмно-син|темно-син|navy/i, '#1F2E4D'],
  // Частые «модные» названия — раньше их не было, и одно такое слово превращало всю ось в текст.
  [/терракот|terracotta/i, '#C0623F'],
  [/изумруд|emerald/i, '#2E8B6E'],
  [/бирюз|turquoise/i, '#3FB5B0'],
  [/мятн|mint/i, '#A8DCC4'],
  [/оливк|olive/i, '#7A7B3A'],
  [/горчич|mustard/i, '#C9A227'],
  [/графит|graphite/i, '#4A4A4D'],
  [/шоколад|chocolate/i, '#5A3825'],
  [/капучино|мокко|mocha/i, '#A47E64'],
  [/марсал|marsala/i, '#8E3B46'],
  [/персик|peach/i, '#F2B394'],
  [/пудр|powder/i, '#E8C6C0'],
  [/лаванд|lavender/i, '#B4A5D6'],
  [/сирен|lilac/i, '#B58BC4'],
  [/молоч|кремов|айвори|ivory|cream/i, '#F3EBDC'],
  [/бел|white|ақ/i, '#FFFFFF'],
  [/чёрн|черн|black|қара/i, '#1F1F1C'],
  [/сер|grey|gray|сұр/i, '#9A9A95'],
  [/беж|beige/i, '#D8CFC2'],
  [/коричн|brown/i, '#7A5236'],
  [/бордо|burgundy/i, '#7B2233'],
  [/красн|red|қызыл/i, '#C8423B'],
  [/голуб|light blue/i, '#8EC1E6'],
  [/син|blue|көк/i, '#2F5DA8'],
  [/хаки|khaki/i, '#7C7A4F'],
  [/зел|green|жасыл/i, '#4E8A4B'],
  [/жёлт|желт|yellow|сары/i, '#E6C34A'],
  [/оранж|orange/i, '#E08A3C'],
  [/роз|pink/i, '#E7A0AE'],
  [/фиолет|purple|violet/i, '#7E5AA6'],
];

export function colourOf(name: string): string | undefined {
  return COLOURS.find(([pattern]) => pattern.test(name))?.[1];
}

/** Значения полей варианта, как их читает клиент: код поля → текст. */
export function valuesOf(variant: ShowcaseVariantDto): Map<string, { name: string; text: string; hex?: string }> {
  return new Map(variant.fields
    .map((field) => [field.code, { name: field.name, text: fieldText(field), hex: field.hex }] as const)
    .filter(([, value]) => value.text !== ''));
}

/**
 * Оси выбора — поля, значения которых у вариантов различаются. Совпадающие
 * (состав, сезон) выбирать не из чего, и в выбор они не попадают. Цвет
 * первым, размер вторым, как в макете.
 */
export function axesOf(variants: ShowcaseVariantDto[]): Axis[] {
  const values = variants.map(valuesOf);
  const codes = new Map<string, string>();
  values.forEach((map) => map.forEach((value, code) => { if (!codes.has(code)) codes.set(code, value.name); }));
  const axes: Axis[] = [];
  codes.forEach((name, code) => {
    const options = [...new Set(values.map((map) => map.get(code)?.text).filter((text): text is string => !!text))];
    if (options.length < 2) return;
    const hexes: Record<string, string> = {};
    values.forEach((map) => { const value = map.get(code); if (value?.hex) hexes[value.text] = value.hex; });
    axes.push({ code, name, colour: COLOUR.test(name) || COLOUR.test(code), options, hexes });
  });
  const rank = (axis: Axis) => (axis.colour ? 0 : SIZE.test(axis.name) || SIZE.test(axis.code) ? 1 : 2);
  // Размеры — по росту: сервер отдаёт варианты в порядке заведения, и «44, 50, 46» читалось как ошибка.
  for (const axis of axes) if (rank(axis) === 1) axis.options.sort(bySize);
  return axes.sort((a, b) => rank(a) - rank(b));
}

const LETTERS = ['XXS', 'XS', 'S', 'M', 'L'];

/** Место размера на шкале: число — само число, буквы — по шкале (XL, XXL = 2XL, 3XL…), иначе — нет места. */
function sizeKey(size: string): number | undefined {
  const text = size.trim().toUpperCase();
  const number = /^\d+(?:[.,]\d+)?$/.exec(text);
  if (number) return Number(text.replace(',', '.'));
  if (LETTERS.includes(text)) return 1000 + LETTERS.indexOf(text);
  // XL — первый «икс», XXL и 2XL — второй, XXXL и 3XL — третий.
  const xs = /^(X+)L$/.exec(text)?.[1].length ?? Number(/^(\d)XL$/.exec(text)?.[1]);
  return xs ? 1000 + LETTERS.length + xs : undefined;
}

/** Сравнение размеров; без места на шкале — как пришли (сортировка устойчива). */
export function bySize(a: string, b: string): number {
  const ka = sizeKey(a);
  const kb = sizeKey(b);
  return ka === undefined || kb === undefined ? 0 : ka - kb;
}

/**
 * Цвет кружка значения: заданный продавцом у варианта поля, а без него — узнанный по названию.
 * Раньше брался только по названию, и «Изумрудный» превращал всю ось в текстовые кнопки.
 */
export function swatchOf(axis: Axis, option: string): string | undefined {
  return axis.hexes?.[option] ?? colourOf(option);
}

/** Кружками ли рисовать ось: цвет, и у каждого значения есть цвет кружка. */
export function swatchesOf(axis: Axis): boolean {
  return axis.colour && axis.options.every((option) => swatchOf(axis, option));
}

/**
 * Какой вариант выбрать, когда по оси `axis` нажали `option`.
 *
 * Остальные поля по возможности сохраняются: выбрав другой цвет, человек
 * ждёт тот же размер, а не первый попавшийся. Общее у карточки товара
 * и плитки витрины — иначе одно и то же нажатие приводило бы в разные места.
 */
export function pickVariant(
  variants: ShowcaseVariantDto[],
  axes: Axis[],
  current: ShowcaseVariantDto,
  axis: Axis,
  option: string,
): ShowcaseVariantDto | undefined {
  const mine = valuesOf(current);
  const matches = variants.filter((variant) => valuesOf(variant).get(axis.code)?.text === option);
  return matches.find((variant) => {
    const values = valuesOf(variant);
    return axes.every((other) => other.code === axis.code || values.get(other.code)?.text === mine.get(other.code)?.text);
  }) ?? matches[0];
}

/**
 * Выбор варианта — цвет кружками, размер и прочее плашками, как в макете
 * «Карточка товара v2». Вариант — это отдельная позиция продавца, поэтому
 * выбор открывает её карточку: цена, наличие и корзина у каждой свои.
 *
 * При смене одного поля остальные по возможности сохраняются: выбрав другой
 * цвет, человек ждёт тот же размер, а не первый попавшийся.
 *
 * `sizeAction` встаёт справа от подписи размера — «Как подобрать размер».
 * Слотом, а не внутри выбора: подсказка ведёт к вопросу продавцу, а форма
 * вопроса живёт в карточке, не здесь.
 */
export function VariantPicker({
  itemId,
  variants,
  sizeAction,
  hideSizes = false,
  chart,
  grid,
}: {
  itemId: string;
  variants: ShowcaseVariantDto[];
  sizeAction?: ReactNode;
  /** Одежда оптом — линейками (2026-11-14): размер не выбирают, ось размера скрыта, цвет остаётся. */
  hideSizes?: boolean;
  /** Таблица размеров продавца: из неё подписи INT и EUR у переключателя систем. */
  chart?: SizeChartDto;
  /** Сетка модели (женская/мужская): по ней пустые клетки INT и EUR таблицы выбора размера. */
  grid?: SizeGrid;
}) {
  const { t } = useTranslation();
  const [system, setSystem, systems] = useSizeSystem(chart);
  const navigate = useNavigate();
  const axes = axesOf(variants).filter((axis) => !hideSizes || axis.colour || !(SIZE.test(axis.name) || SIZE.test(axis.code)));
  const current = variants.find((variant) => variant.itemId === itemId);
  if (axes.length === 0 || !current) return null;
  const mine = valuesOf(current);
  // Размеры таблицей RUS | INT | EUR — когда у продавца есть таблица с INT или EUR (решение владельца
  // 2026-11-14, как состав линейки в «Оптом»); без неё — плашками.
  const sizeAxis = axes.find((axis) => !axis.colour && (SIZE.test(axis.name) || SIZE.test(axis.code)));
  const sizeRows = new Map((sizeAxis?.options ?? []).map((option) => [option, sizeRow(option, chart, grid)]));
  // Столбец — система, где есть значение хоть у одного размера: из таблицы продавца или по сетке модели.
  // Столбец, повторяющий RUS («S» и «S»), не нужен: тогда остаются плашки.
  const tableSystems = (['RUS', 'INT', 'EUR'] as SizeSystem[])
    .filter((one) => [...sizeRows.values()].some((row) => row[one] && (one === 'RUS' || row[one] !== row.RUS)));
  const sizeTable = tableSystems.length > 1;

  // Позиция этого значения при остальных полях как у открытой: размер того же цвета.
  const variantOf = (axis: Axis, option: string) => variants.find((variant) => valuesOf(variant).get(axis.code)?.text === option
    && axes.every((other) => other.code === axis.code || valuesOf(variant).get(other.code)?.text === mine.get(other.code)?.text));
  // Размер без остатка — помечен, но выбирается: в его карточке «Сообщить о поступлении» (просьба владельца 2026-11-15).
  const soldOut = (axis: Axis, option: string) => variantOf(axis, option)?.stock === 'OUT_OF_STOCK';

  function pick(from: ShowcaseVariantDto, axis: Axis, option: string) {
    const best = pickVariant(variants, axes, from, axis, option);
    if (best && best.itemId !== itemId) navigate(`/catalog/${best.itemId}`, { replace: true });
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {axes.map((axis) => {
        const chosen = mine.get(axis.code)?.text;
        // Цвет — кружками цвета, а не снимками (решение владельца 2026-11-14).
        const swatches = swatchesOf(axis);
        const size = !axis.colour && (SIZE.test(axis.name) || SIZE.test(axis.code));
        const shown = (option: string) => (size ? sizeIn(chart, option, system) : option);
        return (
          <div key={axis.code} role="group" aria-label={axis.name} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-body text-ink-muted">
                {axis.name}: <b className="text-ink">{chosen ? shown(chosen) : '—'}</b>
              </span>
              {size ? (
                <span className="flex flex-wrap items-baseline gap-x-2">
                  {sizeTable ? null : <SizeSystemSwitch value={system} systems={systems} onChange={setSystem} />}
                  {sizeAction}
                </span>
              ) : null}
            </div>
            {size && sizeTable ? (
              <SizeRows axis={axis} chosen={chosen} rows={sizeRows} systems={tableSystems}
                has={(option) => !!variantOf(axis, option)} soldOut={(option) => soldOut(axis, option)}
                onPick={(option) => pick(current, axis, option)} />
            ) : (
            <div className="flex flex-wrap gap-2.5">
              {axis.options.map((option) => {
                const on = option === chosen;
                const empty = size && soldOut(axis, option);
                return swatches ? (
                  <button
                    key={option}
                    type="button"
                    title={option}
                    aria-label={t('item.variantOption', { name: axis.name, value: option })}
                    aria-pressed={on}
                    onClick={() => pick(current, axis, option)}
                    style={{ background: swatchOf(axis, option) }}
                    className={cn(
                      'size-10 rounded-full border-[3px] border-surface transition-shadow duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                      on ? 'shadow-[0_0_0_2.5px_var(--color-accent)]' : 'shadow-[0_0_0_1.5px_var(--color-line)]',
                    )}
                  />
                ) : (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={on}
                    aria-label={empty ? `${t('item.variantOption', { name: axis.name, value: option })}, ${t('item.sizeSoldOut')}`
                      : size && shown(option) !== option ? t('item.variantOption', { name: axis.name, value: option }) : undefined}
                    data-sold-out={empty || undefined}
                    onClick={() => pick(current, axis, option)}
                    className={cn(
                      'h-[46px] min-w-[54px] rounded-[var(--radius-control)] border px-3.5 text-body font-bold transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:border-ink/50',
                      empty && 'line-through decoration-2',
                      empty && !on && 'border-dashed text-ink-subtle',
                    )}
                  >
                    {shown(option)}
                  </button>
                );
              })}
            </div>
            )}
          </div>
        );
      })}
      <div aria-hidden="true" className="h-px bg-hairline" />
    </div>
  );
}

/**
 * Выбор размера строкой таблицы: RUS — как завёл продавец, INT и EUR — из его таблицы размеров.
 * Строка — кнопка выбора; размера, которого нет в этом цвете, — «нет», выбрать его можно (откроется
 * другой цвет), как у плашек.
 */
function SizeRows({ axis, chosen, rows, systems, has, soldOut, onPick }: {
  axis: Axis;
  chosen: string | undefined;
  rows: Map<string, Record<SizeSystem, string | undefined>>;
  systems: SizeSystem[];
  has: (option: string) => boolean;
  soldOut: (option: string) => boolean;
  onPick: (option: string) => void;
}) {
  const { t } = useTranslation();
  // Колонка пометки одной ширины во всех строках: каждая строка — своя сетка, и «auto» сдвигало RUS/INT у строки с «нет в наличии».
  const marked = axis.options.some((option) => !has(option) || soldOut(option));
  const columns = { gridTemplateColumns: `repeat(${systems.length}, minmax(0, 1fr)) ${marked ? '7.5rem' : '3rem'}` };
  const cell = 'px-3 py-2 text-center';
  return (
    <div role="radiogroup" aria-label={axis.name} data-testid="size-rows"
      className="overflow-hidden rounded-[var(--radius-control)] bg-surface shadow-[0_0_0_1px_var(--color-hairline)]">
      <div aria-hidden="true" style={columns} className="grid bg-sunk text-caption font-bold text-ink-muted">
        {systems.map((system) => <span key={system} className={cell}>{system}</span>)}
        <span className={cell} />
      </div>
      {axis.options.map((option) => {
        const on = option === chosen;
        const present = has(option);
        const empty = present && soldOut(option);
        return (
          <button key={option} type="button" role="radio" aria-checked={on}
            aria-label={t('item.variantOption', { name: axis.name, value: systems.map((system) => rows.get(option)?.[system] ?? '—').join(' · ') }) + (empty ? `, ${t('item.sizeSoldOut')}` : '')}
            data-sold-out={empty || undefined}
            onClick={() => onPick(option)} style={columns}
            className={cn(
              'grid w-full cursor-pointer items-center border-0 border-t border-solid border-hairline text-body tabular-nums transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
              on ? 'bg-accent text-on-accent font-bold' : present && !empty ? 'bg-surface text-ink hover:bg-sunk' : 'bg-surface text-ink-subtle hover:bg-sunk',
            )}>
            {systems.map((system, index) => (
              <span key={system} className={cn(cell, index === 0 && 'font-extrabold')}>{rows.get(option)?.[system] ?? '—'}</span>
            ))}
            <span className={cn(cell, 'text-caption leading-tight')}>{!present ? t('item.sizeMissing') : empty ? t('item.sizeSoldOut') : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
