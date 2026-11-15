import type { TFunction } from 'i18next';
import type { ItemSaleTerms } from '../../api/generated';

/**
 * Штучная ли единица. Продавец пишет единицу свободным текстом, и «шт»,
 * «шт.», «штука» и «pcs» для клиента значат одно и то же — поэтому
 * сравнение по списку написаний, а не по точной строке. Незнакомая
 * единица штучной не считается: «поштучно» про мешок было бы неправдой.
 */
const PIECE = /^(шт\.?|штук[аи]?|pcs?\.?|pieces?|дана)$/i;

export function isPieceUnit(unit: string): boolean {
  return PIECE.test(unit.trim());
}

/**
 * Пилюля «Продаётся поштучно» у наличия в карточке товара. Выводится из того, что продавец уже
 * указал (единица и кратность), — отдельного поля для этого нет. Только при кратности 1 и без
 * минимума: иначе рядом уже стоят «Заказ от…» и «Продаём по…», и третья пилюля о том же спорила
 * бы с ними. В характеристиках строки «Продаётся» нет — она повторяла пилюлю (просьба владельца 2026-11-14).
 */
export function soldByPill(unit: string, terms: ItemSaleTerms | undefined, t: TFunction): string | undefined {
  const step = terms?.quantityStep ?? 1;
  const least = terms?.minQuantity ?? 1;
  return step <= 1 && least <= 1 && isPieceUnit(unit) ? t('item.soldBy.piece') : undefined;
}
