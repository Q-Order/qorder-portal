/**
 * Стандартные соответствия размеров одежды RUS ↔ INT ↔ EUR (решение владельца 2026-11-14):
 * женская сетка — EUR = RUS − 6, мужская — EUR = RUS; унисекс считается по мужской.
 * Источники: toolfox.ru/tools/womens-clothing-sizes и /mens-clothing-sizes. У букв единого
 * стандарта нет (женское M — и 44, и 46), поэтому это ориентир: заполненное продавцом в своей
 * таблице размеров всегда главнее (см. `sizeIn`).
 */
export type SizeGrid = 'WOMEN' | 'MEN' | 'UNISEX';

type Row = readonly [rus: number, intl: string, eur: number];

const WOMEN: Row[] = [
  [38, 'XXS', 32], [40, 'XS', 34], [42, 'S', 36], [44, 'M', 38], [46, 'M', 40], [48, 'L', 42],
  [50, 'L', 44], [52, 'XL', 46], [54, 'XXL', 48], [56, 'XXL', 50], [58, 'XXXL', 52], [60, '4XL', 54],
];

const MEN: Row[] = [
  [44, 'XS', 44], [46, 'S', 46], [48, 'M', 48], [50, 'L', 50], [52, 'XL', 52], [54, 'XXL', 54],
  [56, 'XXXL', 56], [58, '4XL', 58],
];

const ALIASES: Record<string, string> = { '2XL': 'XXL', '3XL': 'XXXL', XXXXL: '4XL' };

export interface StandardSize {
  rus: string;
  intl: string;
  eur: string;
}

const rowsOf = (grid: SizeGrid) => (grid === 'WOMEN' ? WOMEN : MEN);

/** «44–46» из ряда чисел или букв без повторов; одно значение — без тире. */
function span(values: (string | number)[]): string {
  const unique = [...new Set(values.map(String))];
  return unique.length > 1 ? `${unique[0]}–${unique[unique.length - 1]}` : unique[0] ?? '';
}

function rowsFor(part: string, rows: Row[]): Row[] {
  const upper = part.trim().toUpperCase();
  const letter = ALIASES[upper] ?? upper;
  const byLetter = rows.filter((row) => row[1] === letter);
  if (byLetter.length > 0) return byLetter;
  const number = /^(?:RU\s*)?(\d{2})#?$/.exec(upper)?.[1];
  return number ? rows.filter((row) => row[0] === Number(number)) : [];
}

/**
 * Размер `label` (как его завёл продавец: «48», «XS», «40-42», «S-M») во всех трёх системах
 * по стандартной сетке; пусто — размер не из таблицы (детский, «единый» и т. п.).
 */
export function standardSize(label: string, grid: SizeGrid | undefined): StandardSize | undefined {
  if (!grid) return undefined;
  const rows = label.split(/\s*[-–/]\s*/).flatMap((part) => rowsFor(part, rowsOf(grid)));
  if (rows.length === 0) return undefined;
  return { rus: span(rows.map((row) => row[0])), intl: span(rows.map((row) => row[1])), eur: span(rows.map((row) => row[2])) };
}
