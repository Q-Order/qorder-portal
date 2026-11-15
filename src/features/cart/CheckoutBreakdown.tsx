import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';
import { decimal, money } from '../../shared/format';
import type { Currency } from '../../shared/currency';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { GoodsLine, VatLine } from './CartTotals';
import type { Checkout } from './useCheckout';
import { chosenCarrier } from './carrier';
import { paymentPlan } from './paymentPlan';
import { useDeliveryOptions } from './DeliveryBlock';

/**
 * Расчёт заявки строками: товары, НДС, доставка, грузчики и их налог.
 * `details` — на телефоне расчёт показан по «Подробнее» (на мониторе — всегда).
 */
export function CheckoutBreakdown({ checkout, details }: { checkout: Checkout; details: boolean }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const { cart, lines, totals } = checkout;
  const { shipping, direct, loaders, vatRate, deliveryVat, loadersVat } = totals;
  // Самовывоз — строкой «Самовывоз», а не «Доставка — по договорённости» (замечание владельца 2026-11-15).
  const pickup = useReceiveWay(checkout) === 'PICKUP';
  return (
    // Черта отделяет итог от названий и наличия над ним; первым в карточке (телефон, шаг «Отправить») — без черты.
    <div id="checkout-breakdown" className={cn('flex flex-col gap-2 border-t border-hairline pt-3.5 first:border-t-0 first:pt-0', !details && 'max-lg:hidden')}>
      {/* Пустая корзина — без «Товары, 0 позиций · 0 тенге» и без НДС: нулевые строки читаются как посчитанное. */}
      {cart && lines.length > 0 && <GoodsLine cart={cart} />}
      {/*
        НДС товаров — сразу под товарами: он сверху их цены и уже в итоге
        корзины. У доставки и грузчиков свой режим способа — их налог
        строкой под каждой услугой.
      */}
      {cart && lines.length > 0 && <VatLine cart={cart} />}
      <div className="flex justify-between gap-2 text-body text-ink-muted">
        <span>{t(pickup ? 'checkout.delivery.pickup' : 'checkout.summary.delivery')}</span>
        <span data-testid="delivery-total" className="tabular-nums text-ink">
          {pickup
            ? (shipping ? money(shipping, currency) : t('checkout.steps.free'))
            : direct
            ? (shipping === undefined
              ? t('checkout.delivery.carrierTariff')
              : t('checkout.summary.deliveryInfo', { amount: money(shipping, currency) }))
            : (shipping === undefined ? t('checkout.summary.negotiable') : money(shipping, currency))}
        </span>
      </div>
      <ServiceVat testId="delivery-vat" vat={deliveryVat} rate={vatRate}
        label="checkout.summary.deliveryVatOnTop" currency={currency} />
      {loaders && !loaders.direct && (
        <div className="flex justify-between gap-2 text-body text-ink-muted">
          <span>{t('checkout.summary.loaders')}</span>
          <span data-testid="loaders-total" className="tabular-nums text-ink">
            {loaders.amount === undefined ? t('checkout.summary.loadersLater') : money(loaders.amount, currency)}
          </span>
        </div>
      )}
      <ServiceVat testId="loaders-vat" vat={loadersVat} rate={vatRate}
        label="checkout.summary.loadersVatOnTop" currency={currency} />
    </div>
  );
}

/**
 * «Итого» продавцу и расклад «кому сколько»: что продавец добавит при проверке,
 * что платится перевозчику и грузчикам напрямую, и сколько всего выйдет за заказ.
 * `onToggle` — кнопка «Подробнее» на телефоне; без него кнопки нет.
 */
export function CheckoutTotal({ checkout, details, onToggle }: { checkout: Checkout; details: boolean; onToggle?: () => void }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const { method, delivery, totals } = checkout;
  const plan = paymentPlan(totals, chosenCarrier(method, delivery)?.name ?? delivery.ownCarrier?.trim());
  // Способ ещё не выбран — «доставку назовёт продавец» было бы неправдой: её может и не быть.
  if (!method) plan.sellerLater = plan.sellerLater.filter((part) => part !== 'delivery');
  const sellerLabel = plan.separate.length > 0 ? t('checkout.pay.toSeller') : t('checkout.summary.toPay');
  return (
    <>
      {/* Сумма — одной строкой: знак валюты, ушедший на вторую, читается как другое число. */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <span className="text-lg font-bold text-ink">{sellerLabel}</span>
          {onToggle && (
            <button
              type="button"
              aria-expanded={details}
              aria-controls="checkout-breakdown"
              onClick={onToggle}
              className="text-sm font-semibold text-accent-ink underline underline-offset-[3px] lg:hidden"
            >
              {details ? t('checkout.summary.less') : t('checkout.summary.more')}
            </button>
          )}
        </span>
        <span data-testid="total" className="whitespace-nowrap text-title font-extrabold tracking-[-0.02em] tabular-nums text-ink sm:text-display">
          {money(totals.total, currency)}
        </span>
      </div>
      {plan.sellerLater.length > 0 && (
        <p data-testid="seller-later" className="text-caption text-ink-muted">
          {t(`checkout.pay.later.${plan.sellerLater.join('_')}`)}
        </p>
      )}
      {plan.separate.length > 0 && (
        <div data-testid="pay-separately" className="flex flex-col gap-1.5 border-t border-hairline pt-2.5">
          <span className="text-caption font-semibold text-ink">{t('checkout.pay.separately')}</span>
          {plan.separate.map((payment) => (
            <div key={payment.kind} data-testid={payment.kind === 'carrier' ? 'delivery-direct' : 'loaders-direct'}
              className="flex justify-between gap-2 text-body text-ink-muted">
              <span>{payment.kind === 'carrier'
                ? (payment.name ? t('checkout.pay.carrierNamed', { name: payment.name }) : t('checkout.pay.carrier'))
                : t('checkout.pay.loaders')}</span>
              <span className="tabular-nums text-ink">
                {payment.amount !== undefined ? money(payment.amount, currency)
                  : payment.kind === 'carrier' ? t('checkout.pay.byCarrierTariff') : t('checkout.summary.loadersLater')}
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-2 border-t border-hairline pt-2.5">
            <span className="font-semibold text-ink">{t('checkout.pay.grand')}</span>
            <span data-testid="grand-total" className="whitespace-nowrap text-lg font-bold tabular-nums text-ink">
              {plan.approximate ? t('checkout.pay.from', { amount: money(plan.grand, currency) }) : money(plan.grand, currency)}
            </span>
          </div>
          {plan.approximate && (
            <p className="text-caption text-ink-muted">{t('checkout.pay.grandHint')}</p>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Налог услуги продавца под её строкой: «сверху» — отдельной суммой, она
 * прибавлена к «Итого»; «внутри» — мелкой подписью: в итоге он уже есть.
 */
function ServiceVat({ testId, vat, rate, label, currency }: {
  testId: string;
  vat: { vat: number; onTop: number };
  rate: number | undefined;
  label: 'checkout.summary.deliveryVatOnTop' | 'checkout.summary.loadersVatOnTop';
  currency: Currency | undefined;
}) {
  const { t } = useTranslation();
  if (vat.vat <= 0 || rate === undefined) return null;
  if (vat.onTop > 0) {
    return (
      <div data-testid={testId} className="flex justify-between gap-2 text-body text-ink-muted">
        <span>{t(label, { rate: decimal(rate) })}</span>
        <span className="tabular-nums text-ink">{money(vat.onTop, currency)}</span>
      </div>
    );
  }
  return (
    <p data-testid={testId} className="-mt-1.5 text-right text-caption text-ink-muted">
      {t('checkout.summary.vatInside', { amount: money(vat.vat, currency) })}
    </p>
  );
}

/** Как клиент получит заявку: самовывоз, доставка или ещё не выбрано. */
export function useReceiveWay(checkout: Checkout): 'PICKUP' | 'DELIVERY' | undefined {
  const options = useDeliveryOptions();
  const method = options?.methods.find((candidate) => candidate.id === checkout.delivery.methodId);
  if (options?.mode === 'PICKUP_ONLY' || method?.pickup || (!method && checkout.delivery.pickupPointId)) return 'PICKUP';
  return method ? 'DELIVERY' : undefined;
}
