import type { ShowcaseWholesaleDto } from '../../api/generated';

/**
 * Опт в корзине портала.
 *
 * Корзина считает штуки, а опт делит сервер: целые упаковки по цене ступени
 * и розничный остаток (`CartLineDto.split`). Здесь — только то, что нужно
 * до корзины: у товара «только опт» витрина отдаёт цену, единицу и условия
 * в упаковках, и поле количества считает упаковки — в корзину уходят штуки.
 */

/** «Только опт»: штуками не продаётся, поле количества — в упаковках. */
export function packsOnly(item: { wholesale?: ShowcaseWholesaleDto }): boolean {
  return !!item.wholesale && !item.wholesale.retail;
}

/** Количество поля витрины — в штуки корзины. */
export function toPieces(item: { wholesale?: ShowcaseWholesaleDto }, quantity: number): number {
  return packsOnly(item) ? quantity * item.wholesale!.packQty : quantity;
}

/** Ступень, до которой дотянулось число упаковок; меньше первой — пусто. */
export function tierFor<T extends { from: number }>(tiers: T[], packs: number): T | undefined {
  return tiers.filter((tier) => tier.from <= packs).pop();
}

/**
 * Разбиение штук до корзины — то же правило, что у сервера (`WholesaleSplit`):
 * целые упаковки по ступени, не дотянули до первой — всё в розницу. Упаковки идут по ступени,
 * даже когда розница со своей распродажей дешевле (решение владельца 2026-11-13).
 */
export function splitOf(wholesale: ShowcaseWholesaleDto, pieces: number) {
  const whole = Math.floor(pieces / wholesale.packQty);
  const tier = tierFor(wholesale.tiers, whole);
  const packs = tier ? whole : 0;
  return { packs, tier, rest: pieces - packs * wholesale.packQty };
}
