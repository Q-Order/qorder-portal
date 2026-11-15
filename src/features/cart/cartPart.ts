import { getGetPortalCartPartQueryKey, useGetPortalCartPart, type CartDto, type CartLineDto } from '../../api/generated';
import type { SaleMode } from './ModeSwitch';
import { useOrderMode } from './orderMode';
import { cartOf, useCart } from './useCart';
import { useUnpicked } from './cartPick';

/**
 * В какой заявке строка — то же правило, что у сервера (`PortalOrderServiceImpl.modeOf`):
 * выбранный режим у товара «оптом и в розницу», иначе упаковки — оптовая, штуки — розничная.
 */
export function lineMode(line: CartLineDto): SaleMode {
  return line.mode ?? (line.split ? 'WHOLESALE' : 'RETAIL');
}

/** Строка корзины однозначно: у товара «оптом и в розницу» строк две — розничная и оптовая. */
export function lineKey(line: CartLineDto): string {
  return `${line.itemId}:${lineMode(line)}`;
}

/** Строка корзины, как её видит клиент: размеры одной линейки одежды — одна строка. */
export type CartRow = { kind: 'one'; line: CartLineDto } | { kind: 'line'; key: string; rows: CartLineDto[] };

/**
 * Строки корзины для показа: размеры линейки (общий `line.key`) — одной строкой «N линеек»
 * на месте первого размера (решение владельца 2026-11-14). Сервер хранит их по артикулам размеров.
 */
export function cartRows(lines: CartLineDto[]): CartRow[] {
  const rows: CartRow[] = [];
  const groups = new Map<string, CartLineDto[]>();
  for (const line of lines) {
    const key = line.line?.key;
    if (!key) { rows.push({ kind: 'one', line }); continue; }
    const group = groups.get(key);
    if (group) { group.push(line); continue; }
    const fresh = [line];
    groups.set(key, fresh);
    rows.push({ kind: 'line', key, rows: fresh });
  }
  return rows;
}

/** Сколько позиций в корзине: линейка из шести размеров — одна позиция, а не шесть. */
export function positionCount(lines: CartLineDto[] | undefined): number {
  return cartRows(lines ?? []).length;
}

/**
 * Строка позиции в заявке `mode`. У товара «оптом и в розницу» строк до двух — розничная и оптовая
 * (у них есть `mode`); у остальных одна, без режима. Режим не задан — первая строка позиции.
 */
export function lineOf(cart: CartDto | undefined, itemId: string, mode?: SaleMode): CartLineDto | undefined {
  return cart?.lines.find((line) => line.itemId === itemId && (mode === undefined || !line.mode || line.mode === mode));
}

/** Позиции, взятые в заявку `mode`: розничная строка не делает товар «взятым» в опте, и наоборот. */
export function takenIn(cart: CartDto | undefined, mode: SaleMode): Set<string> {
  // Линейка одежды взята целиком: плитка модели — любой её размер — показывает её взятой.
  return new Set((cart?.lines ?? []).filter((line) => !line.mode || line.mode === mode)
    .flatMap((line) => [line.itemId, ...(line.line?.sizes.map((size) => size.itemId) ?? [])]));
}

/** Сколько линеек одежды взято у модели, в линейку которой входит позиция; ноль — не взята. */
export function linesIn(cart: CartDto | undefined, itemId: string): number {
  return lineGroupOf(cart, itemId)?.lines ?? 0;
}

/** Взятая линейка, в которую входит позиция; пусто — не взята. */
export function lineGroupOf(cart: CartDto | undefined, itemId: string) {
  return (cart?.lines ?? []).find((one) => one.line?.sizes.some((size) => size.itemId === itemId))?.line;
}

/**
 * Корзина одной заявки: оптовая и розничная заявки раздельные («Вариант Б», решение владельца
 * 2026-11-04). Пока в корзине строки одного вида, она отдаётся как есть — со скидками и НДС
 * сервера. Когда видов два — строки выбранного, итог — их сумма.
 */
export function partOf(cart: CartDto, mode: SaleMode): CartDto {
  return subset(cart, cart.lines.filter((line) => lineMode(line) === mode));
}

/**
 * Корзина из части строк: итог — их сумма, без скидки на заявку и НДС. Только на миг, пока сервер
 * не ответил своей частью (`useCartPart`), — и как запасной показ, если ответа нет.
 */
function subset(cart: CartDto, lines: CartLineDto[]): CartDto {
  const sum = lines.reduce((total, line) => total + (line.total ?? 0), 0);
  return { ...cart, lines, goodsTotal: sum, total: sum, saleSavings: 0, discount: undefined, nextTier: undefined, vatAmount: undefined };
}

/**
 * Корзина текущей заявки, её вид и сколько строк в каждой из двух.
 *
 * `shown` — все строки открытой заявки, их список с галочками; `cart` — только отмеченные:
 * их итог и оформление. Не всё положенное клиент заказывает сейчас — остальное ждёт в корзине.
 */
export function useCartPart(active = true) {
  const full = cartOf(useCart(active).data);
  const [mode, setMode] = useOrderMode();
  const pick = useUnpicked();
  const counts = { WHOLESALE: 0, RETAIL: 0 };
  for (const row of cartRows(full?.lines ?? [])) counts[lineMode(row.kind === 'one' ? row.line : row.rows[0])] += 1;
  const split = counts.WHOLESALE > 0 && counts.RETAIL > 0;
  // Строки одного вида — та заявка и открыта, даже если в каталоге выбран другой способ.
  const part: SaleMode | undefined = split ? mode : counts.WHOLESALE > 0 ? 'WHOLESALE' : counts.RETAIL > 0 ? 'RETAIL' : undefined;
  const shown = full && split ? partOf(full, mode) : full;
  const picked = (shown?.lines ?? []).filter((line) => !pick.off.has(lineKey(line)));
  // Отмечено всё — корзина как есть, со скидками и НДС сервера.
  const some = shown !== undefined && picked.length < shown.lines.length;
  // Часть корзины — со своей скидкой и НДС: сервер считает её так же, как при отправке, и клиент видит
  // скидку заранее (просьба владельца 2026-11-14). В ключе — состав строк: изменилось количество — пересчёт.
  const partial = full !== undefined && (split || some);
  const params = { mode: split ? mode : undefined, itemIds: some ? picked.map((line) => line.itemId) : undefined };
  const lines = (full?.lines ?? []).map((line) => `${lineKey(line)}=${line.quantity}:${line.total ?? ''}`).join('|');
  const server = useGetPortalCartPart(params, {
    query: {
      enabled: active && partial,
      queryKey: [...getGetPortalCartPartQueryKey(params), lines],
      // Прежний итог держится, пока идёт новый, — но только той же заявки: чужой на миг был бы неправдой.
      placeholderData: (previous, query) => ((query?.queryKey[1] as { mode?: string } | undefined)?.mode === params.mode ? previous : undefined),
    },
  });
  const counted = server.data?.status === 200 ? server.data.data : undefined;
  return {
    cart: !shown || !partial ? shown : counted ?? (some ? subset(shown, picked) : shown),
    shown,
    /** Позиции, отмеченные галочками, — пусто, когда отмечено всё (уходит вся заявка). */
    itemIds: some ? picked.map((line) => line.itemId) : undefined,
    pick,
    part,
    split,
    counts,
    setMode,
  };
}
