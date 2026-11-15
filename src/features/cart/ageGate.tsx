import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalCartQueryKey,
  useConfirmPortalAge,
  type ItemSaleTerms,
  type ShowcaseWholesaleDto,
} from '../../api/generated';
import type { SaleMode } from './ModeSwitch';
import { useOrderMode } from './orderMode';
import { toPieces } from './wholesale';
import { cartOf, useCart, useSetCartLine, useWholesaleLines } from './useCart';
import { firstQuantity } from './saleTerms';
import { announceAdded } from './cartDrawer';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

/**
 * Вопрос «Вам уже есть 21 год?» — одно окно на весь кабинет.
 *
 * Товар 21+ кладут из витрины, карточки и быстрого ввода, и окно в каждом
 * из этих мест значило бы три разных вопроса об одном и том же. Поэтому
 * вопрос живёт здесь: место, где нажали «В корзину», только спрашивает,
 * а окно рисует оболочка.
 *
 * Спрашивается один раз у магазина: ответ сервер помнит (`ageConfirmed`
 * в корзине), и повторять вопрос на каждой бутылке — значит приучить
 * отвечать «да» не читая.
 */
type Pending = { name: string; age: number; resolve: (adult: boolean) => void } | null;

let pending: Pending = null;
const listeners = new Set<() => void>();

function set(next: Pending) {
  pending = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Спросить возраст: ответ приходит обещанием — «да» только после записи на сервере. */
function askAge(name: string, age: number): Promise<boolean> {
  pending?.resolve(false);
  return new Promise((resolve) => set({ name, age, resolve }));
}

/** Окно вопроса. Рисуется один раз — в оболочке. */
export function AgeGateDialog() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const current = useSyncExternalStore(subscribe, () => pending);
  const confirm = useConfirmPortalAge({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        queryClient.setQueryData(getGetPortalCartQueryKey(), response);
      },
    },
  });

  function answer(adult: boolean) {
    const asked = pending;
    if (!asked) return;
    if (!adult) {
      set(null);
      asked.resolve(false);
      return;
    }
    // Сервер помнит подтверждённый возраст: «18» не открывает товары 21+.
    confirm.mutate({ params: { age: asked.age } }, {
      onSuccess: (response) => {
        set(null);
        asked.resolve(response.status === 200);
      },
      onError: () => {
        set(null);
        asked.resolve(false);
      },
    });
  }

  return (
    <Dialog.Root open={current !== null} onOpenChange={(open) => { if (!open) answer(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/45 dark:bg-black/60" />
        <Dialog.Content
          aria-describedby="age-gate-text"
          className={cn(
            'qo-dialog fixed left-1/2 top-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'flex-col gap-4 rounded-[calc(var(--radius-gallery)*7/6)] bg-surface p-6 shadow-float',
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-full bg-adult text-lg font-extrabold text-white"
          >
            {current?.age ?? 21}+
          </span>
          <Dialog.Title className="text-title font-extrabold lg:text-display tracking-[-0.02em] text-ink">
            {t('catalog.age.title', { count: current?.age ?? 21 })}
          </Dialog.Title>
          <p id="age-gate-text" className="text-base leading-normal text-ink-muted">
            {t('catalog.age.text', { name: current?.name ?? '', count: current?.age ?? 21 })}
          </p>
          <div className="flex flex-col gap-2">
            <Button size="lg" variant="accent" disabled={confirm.isPending} onClick={() => answer(true)}>
              {t('catalog.age.yes', { count: current?.age ?? 21 })}
            </Button>
            <Button size="lg" variant="outline" disabled={confirm.isPending} onClick={() => answer(false)}>
              {t('catalog.age.no')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Положить позицию с учётом её условий: 21+ — после вопроса о возрасте,
 * минимум и кратность — сразу допустимым количеством.
 *
 * @returns `false`, если покупатель ответил «нет» и ничего не положено
 */
export function useAddToCart() {
  const cart = cartOf(useCart().data);
  const setLine = useSetCartLine();
  const lines = useWholesaleLines();
  // Товар «оптом и в розницу» ложится в ту заявку, в которой клиент сейчас («Оптом / В розницу»).
  const [orderMode] = useOrderMode();

  async function add(
    item: { id: string; name: string; terms?: ItemSaleTerms; wholesale?: ShowcaseWholesaleDto },
    quantity?: number,
    mode?: SaleMode,
  ) {
    // Спрашиваем, если подтверждённого возраста не хватает: подтвердивший 18 для 21+ отвечает ещё раз.
    const age = item.terms?.minAge ?? 21;
    if (item.terms?.ageRestricted && (cart?.confirmedAge ?? (cart?.ageConfirmed ? 21 : 0)) < age) {
      const adult = await askAge(item.name, age);
      if (!adult) return false;
    }
    const chosen = mode ?? (item.wholesale?.retail ? orderMode : undefined);
    // Одежда оптом — линейкой размеров, а не штуками (решение владельца 2026-11-14): первая ступень линеек.
    if (item.wholesale?.linePieces && (chosen === 'WHOLESALE' || !item.wholesale.retail)) {
      lines.mutate(
        { itemId: item.id, data: { lines: quantity ?? item.wholesale.tiers[0]?.from ?? 1 } },
        { onSuccess: (response) => { if (response.status === 200) announceAdded(item.name); } },
      );
      return true;
    }
    // В оптовую заявку товар «оптом и в розницу» ложится сразу первой ступенью опта, а не штукой.
    const pieces = quantity === undefined && chosen === 'WHOLESALE' && item.wholesale
      ? item.wholesale.packQty * (item.wholesale.tiers[0]?.from ?? 1)
      : toPieces(item, quantity ?? firstQuantity(item.terms));
    setLine.mutate(
      { itemId: item.id, data: { quantity: pieces, mode: chosen } },
      // Корзины рядом с витриной больше нет — положенное называется
      // уведомлением с кнопкой «Открыть корзину».
      { onSuccess: (response) => { if (response.status === 200) announceAdded(item.name); } },
    );
    return true;
  }

  return { add, isPending: setLine.isPending || lines.isPending };
}
