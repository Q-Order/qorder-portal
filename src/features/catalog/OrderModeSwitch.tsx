import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetPortalCatalogCounts, type GetPortalCatalogChannel, type ShowcaseCounts } from '../../api/generated';
import { useOrderMode } from '../cart/orderMode';
import type { SaleMode } from '../cart/ModeSwitch';
import { cn } from '../../ui/cn';

/**
 * Как магазин продаёт и что выбрал клиент: «Оптом / В розницу» — жёсткий переключатель «Варианта Б»
 * (решение владельца 2026-11-04). Выбор общий с карточкой и корзиной (`orderMode.ts`);
 * у продавца с одним способом переключателя нет и отбор по способу не нужен.
 */
export function useShopChannel() {
  const [orderMode, setOrderMode] = useOrderMode();
  const shopCounts = useGetPortalCatalogCounts({ presence: 'ALL' });
  const shop = shopCounts.data?.status === 200 && isCounts(shopCounts.data.data) ? shopCounts.data.data : undefined;
  const wholesaleModels = (shop?.wholesale ?? 0) + (shop?.both ?? 0);
  const retailModels = (shop?.retail ?? 0) + (shop?.both ?? 0);
  const twoWays = wholesaleModels > 0 && retailModels > 0;
  // Магазин только с оптом — тоже «опт»: ничего не отсекает, но «Акция» берёт оптовую распродажу.
  const channel: GetPortalCatalogChannel | undefined = !twoWays
    ? (wholesaleModels > 0 && retailModels === 0 ? 'ANY_WHOLESALE' : undefined)
    : orderMode === 'WHOLESALE' ? 'ANY_WHOLESALE' : 'ANY_RETAIL';
  return { shop, orderMode, setOrderMode, wholesaleModels, retailModels, twoWays, channel };
}

/** Тёмная полоса с двумя крупными кнопками; под каждой — сколько там моделей (или того, что передали). */
export function OrderModeSwitch({ mode, onMode, note }: {
  mode: SaleMode;
  onMode: (mode: SaleMode) => void;
  /** Подпись под способом; нет — без подписи. */
  note?: (mode: SaleMode) => string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t('catalog.orderMode.label')}
      className="flex w-full max-w-xl gap-1.5 self-start rounded-[1.25rem] bg-night p-1.5">
      {(['WHOLESALE', 'RETAIL'] as const).map((value) => (
        <button key={value} type="button" role="radio" aria-checked={mode === value}
          onClick={() => onMode(value)}
          className={cn(
            'flex min-h-14 flex-1 flex-col items-center justify-center rounded-[0.9375rem] px-2 leading-tight transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            mode === value ? 'bg-surface text-ink' : 'text-night-sub hover:text-white',
          )}>
          <span className="text-body font-extrabold">{t(`catalog.orderMode.${value}`)}</span>
          {note?.(value) ? <span className="text-2xs font-semibold opacity-85">{note(value)}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * Похож ли ответ на числа разделов. Сервер старше этого экрана о них не знает,
 * и число, собранное из чужого ответа, было бы выдумкой — лучше без чисел.
 */
export function isCounts(value: unknown): value is ShowcaseCounts {
  const candidate = value as Partial<ShowcaseCounts> | undefined;
  return typeof candidate?.all === 'number' && typeof candidate.byCategory === 'object' && candidate.byCategory !== null;
}

/**
 * «Оптом | В розницу» в верхней панели монитора (решение владельца 2026-11-05): режим общий для каталога,
 * карточки и корзины, поэтому виден на любой странице. Только у магазина, который продаёт обоими способами.
 */
export function HeaderOrderMode() {
  const { t } = useTranslation();
  const { orderMode: chosen, setOrderMode, twoWays } = useShopChannel();
  const locked = useLockedMode();
  const orderMode = locked ?? chosen;
  // Числа — как в каталоге по умолчанию: только в наличии и тем же отбором способа (просьба владельца 2026-11-06).
  // Сумма «розница + оба» дважды считала модель, у которой одни размеры только в розницу, а другие и оптом.
  // Показывать ли переключатель, решают все товары: закончившийся опт не отменяет способ.
  const number = {
    WHOLESALE: useInStock('ANY_WHOLESALE'),
    RETAIL: useInStock('ANY_RETAIL'),
  };
  if (!twoWays) return null;
  return (
    <div role="radiogroup" aria-label={t('catalog.orderMode.label')} className="flex h-11 shrink-0 items-center gap-0.5 rounded-xl border-[1.5px] border-line bg-surface p-[3px]">
      {(['WHOLESALE', 'RETAIL'] as const).map((mode) => (
        <button key={mode} type="button" role="radio" aria-checked={orderMode === mode} onClick={() => setOrderMode(mode)}
          disabled={!!locked && locked !== mode}
          title={locked && locked !== mode ? t(`catalog.orderMode.only.${locked}`) : undefined}
          className={cn(
            'qo-hit flex h-9 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 items-center gap-1.5 whitespace-nowrap rounded-lg border-0 px-3 text-sm font-extrabold transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            // Выбранный — залит зелёным, как «Оптом / В розницу» в карточке: белое на сером путало клиентов (2026-11-20).
            orderMode === mode ? 'bg-accent text-on-accent' : 'bg-transparent text-ink-muted hover:bg-sunk hover:text-ink',
          )}>
          {t(`catalog.orderMode.${mode}`)}
          <span className="text-xs font-semibold tabular-nums opacity-75">{number[mode]}</span>
        </button>
      ))}
    </div>
  );
}

/*
 * Способ открытой карточки товара одного способа (только опт или только розница): шапка показывает его
 * выбранным, а другой — недоступным; выбор клиента в каталоге не трогается (решение владельца 2026-11-14).
 */
let cardOnly: SaleMode | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Карточка объявляет свой единственный способ, пока открыта; `undefined` — продаётся обоими. */
export function useLockOrderMode(only: SaleMode | undefined) {
  useEffect(() => {
    cardOnly = only;
    listeners.forEach((listener) => listener());
    return () => {
      cardOnly = undefined;
      listeners.forEach((listener) => listener());
    };
  }, [only]);
}

function useLockedMode() {
  return useSyncExternalStore(subscribe, () => cardOnly, () => undefined);
}

/** Сколько моделей в наличии видно в каталоге этим способом. */
function useInStock(channel: GetPortalCatalogChannel) {
  const counts = useGetPortalCatalogCounts({ channel, presence: 'IN_STOCK' });
  return counts.data?.status === 200 && isCounts(counts.data.data) ? counts.data.data.all : undefined;
}
