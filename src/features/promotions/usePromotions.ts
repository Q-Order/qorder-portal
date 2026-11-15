import { useGetPortalCatalogCounts, useGetPortalPromotions } from '../../api/generated';
import { useOrderMode } from '../cart/orderMode';
import type { SaleMode } from '../cart/ModeSwitch';
import { isCounts } from '../catalog/OrderModeSwitch';

/**
 * Чьи акции видит клиент: у опта и розницы свои распродажа, скидка за объём и на первую заявку
 * (решение владельца 2026-11-13). Магазин только с оптом — оптовые, только с розницей — розничные,
 * с обоими — выбранного «Оптом / В розницу». Пока числа магазина не пришли — выбранного.
 */
export function usePromoMode(enabled = true): SaleMode {
  const [orderMode] = useOrderMode();
  // Тот же ключ, что у переключателя способа (`useShopChannel`), — один запрос.
  const counts = useGetPortalCatalogCounts({ presence: 'ALL' }, { query: { enabled } });
  const shop = counts.data?.status === 200 && isCounts(counts.data.data) ? counts.data.data : undefined;
  if (!shop) return orderMode;
  const wholesale = (shop.wholesale ?? 0) + (shop.both ?? 0);
  const retail = (shop.retail ?? 0) + (shop.both ?? 0);
  if (wholesale > 0 && retail === 0) return 'WHOLESALE';
  if (retail > 0 && wholesale === 0) return 'RETAIL';
  return orderMode;
}

/**
 * Акции магазина того вида, которым клиент сейчас заказывает; `part` — вид открытой заявки
 * (оформление): корзина из одних оптовых строк — оптовая заявка, что бы ни было выбрано в каталоге.
 */
export function usePromotions(enabled = true, part?: SaleMode) {
  const chosen = usePromoMode(enabled);
  return useGetPortalPromotions({ mode: part ?? chosen }, { query: { enabled } });
}
