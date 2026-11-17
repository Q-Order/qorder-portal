import { CHIP_ROW } from '../../ui/chipRow';
import { LoadFailed } from '../../ui/LoadFailed';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Funnel, Search } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalNotificationsQueryKey,
  getGetPortalUnreadSummaryQueryKey,
  useGetMyPortalOrders,
  useGetPortalNotifications,
  useReadPortalNotification,
  type PortalOrderDto,
} from '../../api/generated';
import { cn } from '../../ui/cn';
import { Pagination } from '../../ui/Pagination';
import { BackTitle } from '../../ui/BackTitle';
import { CITY_CHIP, HeaderCity } from '../city/HeaderCity';
import { OrderLink, OrderPane, OrderPick } from './OrderRow';
import { useWideScreen } from '../../ui/useWideScreen';
import { OrderStatement } from './OrderStatement';
import {
  FILTERS, ORDER_SIZES, inPeriod, kindOf, matchesFilter, matchesSearch, sorted, unreadByOrder, type OrderFilter, type Period,
} from './myOrdersModel';
import { PeriodChip, PeriodMenu } from './PeriodMenu';

/**
 * Мои заявки — «Вариант Б» (макеты SimplePicOrders / SimplePicWebOrders).
 *
 * Телефон: крупные отборы и карточки, разложенные на «Новое», «Ждут вас» и остальные;
 * всё о заявке — на её экране. Монитор: поиск, отборы и список слева, выбранная заявка справа.
 * Новое берётся из уведомлений кабинета: открыв заявку, клиент их прочитал.
 */
export function MyOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const response = useGetMyPortalOrders();
  const notifications = useGetPortalNotifications();
  const read = useReadPortalNotification({
    mutation: {
      // Сводку тоже: из неё число у «Уведомлений» в «Сообщениях» и счётчики магазинов.
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetPortalUnreadSummaryQueryKey() });
      },
    },
  });
  const orders: PortalOrderDto[] = useMemo(
    () => (response.data?.status === 200 ? response.data.data : []),
    [response.data],
  );
  const unread = useMemo(
    () => unreadByOrder(notifications.data?.status === 200 ? notifications.data.data : []),
    [notifications.data],
  );

  const [filter, setFilter] = useState<OrderFilter>('all');
  const [query, setQuery] = useState('');
  // Период по дате оформления (просьба владельца 2026-11-15): отборы по статусу считаются внутри него.
  const [period, setPeriod] = useState<Period>({});
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(ORDER_SIZES[0]);
  const wide = useWideScreen();
  const [picked, setPicked] = useState<string>();
  // Телефон: отборы ещё и меню слева — не листать ряд плашек вбок (просьба владельца 2026-11-15).
  const [menuOpen, setMenuOpen] = useState(false);
  // Выбранный отбор — на виду: из меню можно выбрать плашку, спрятанную за краем ряда.
  const chipRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chipRow.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [filter]);

  // Телефон: под заголовком — город клиента (для него наличие и доставка); нажатие — в профиль.
  const title = (
    <>
      <BackTitle title={t('orders.title')} />
      {wide ? null : <HeaderCity className={cn(CITY_CHIP, 'self-start')} />}
    </>
  );

  if (response.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((row) => (
          <div key={row} data-testid="order-skeleton"
            className="h-24 animate-pulse rounded-[var(--radius-card)] border-2 border-hairline bg-sunk" />
        ))}
      </div>
    );
  }

  if (response.isError) {
    return (
      <div className="flex flex-col gap-3">
        {title}
        <LoadFailed onRetry={() => void response.refetch()} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {title}
        <p className="text-base text-ink-muted">{t('orders.empty')}</p>
      </div>
    );
  }

  const visible = sorted(
    orders.filter((order) => inPeriod(order, period) && matchesFilter(order, filter) && matchesSearch(order, query)),
    unread,
  );
  const pages = Math.max(1, Math.ceil(visible.length / size));
  const current = Math.min(page, pages - 1);
  const shown = visible.slice(current * size, (current + 1) * size);
  const markRead = (order: PortalOrderDto) => unread.get(order.id)?.ids.forEach((id) => read.mutate({ id }));
  // Любая смена отбора возвращает на первую страницу: иначе клиент остался бы
  // на третьей странице списка, в котором теперь одна.
  const resetAll = () => {
    setFilter('all');
    setQuery('');
    setPeriod({});
    setPage(0);
  };

  const countOf = (key: OrderFilter) => orders.filter((order) => inPeriod(order, period) && matchesFilter(order, key)).length;
  const pickFilter = (key: OrderFilter) => { setFilter(key); setPage(0); };

  const chips = (
    <div ref={chipRow} role="group" aria-label={t('orders.v2.filtersLabel')} className={cn(CHIP_ROW, '-mx-4 gap-2 px-4 pb-1 lg:mx-0 lg:px-0')}>
      {FILTERS.map((key) => {
        const count = countOf(key);
        const active = filter === key;
        return (
          <button key={key} type="button" aria-pressed={active} onClick={() => pickFilter(key)}
            className={cn(
              'inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-2xl border-[3px] border-solid px-3.5 text-body font-extrabold',
              'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              active ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink hover:border-ink',
            )}>
            {t(`orders.v2.filters.${key}`)}
            <span className="tabular-nums">· {count}</span>
          </button>
        );
      })}
    </div>
  );

  const periodMenu = <PeriodMenu value={period} onApply={(next) => { setPeriod(next); setPage(0); }} />;
  const periodChip = <PeriodChip value={period} onReset={() => { setPeriod({}); setPage(0); }} />;

  const nothing = (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line px-5 py-10 text-center">
      <b className="text-base font-extrabold text-ink">{t('orders.v2.nothingTitle')}</b>
      <button type="button" onClick={resetAll} className="cursor-pointer bg-transparent text-sm font-bold text-accent-ink hover:underline">
        {t('orders.v2.resetFilters')}
      </button>
    </div>
  );

  const pager = (
    <Pagination
      page={current}
      size={size}
      total={visible.length}
      sizes={ORDER_SIZES}
      onPage={setPage}
      onSize={(next) => { setSize(next); setPage(0); }}
      label={t('pager.nav')}
    />
  );

  if (wide) {
    // Без выбора — первая в списке: справа не бывает пусто, пока слева есть заявки.
    const selected = shown.find((order) => order.id === picked) ?? shown[0];
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          {title}
          <OrderStatement />
        </div>
        <div data-testid="orders-split" className="grid grid-cols-[27.5rem_minmax(0,1fr)] items-start gap-7">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-2">
            <label className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-control)] border-2 border-line bg-surface px-4 focus-within:border-shop">
              <Search aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
              <input type="search" value={query} placeholder={t('orders.v2.search')} aria-label={t('orders.v2.search')}
                onChange={(event) => { setQuery(event.target.value); setPage(0); }}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink placeholder:text-ink-subtle focus:outline-none" />
            </label>
            {periodMenu}
            </div>
            {/* Плашка периода — в начале ряда отборов: в строке поиска она сжимала поле (2026-11-15). */}
            <div className="flex items-start gap-2">
              {periodChip}
              <div className="min-w-0 flex-1 [&>[role=group]]:ml-0 [&>[role=group]]:pl-0">{chips}</div>
            </div>
            {shown.length === 0 ? nothing : (
              <div className="flex flex-col gap-2.5">
                {shown.map((order) => (
                  <OrderPick key={order.id} order={order} unread={unread.get(order.id)} selected={order.id === selected?.id}
                    onPick={() => { setPicked(order.id); markRead(order); }} />
                ))}
              </div>
            )}
            {pager}
            <p className="m-0 px-1 text-caption text-ink-muted">{t('orders.v2.payNote')}</p>
          </div>
          {selected ? <OrderPane key={selected.id} order={selected} /> : null}
        </div>
      </div>
    );
  }

  const waits = (order: PortalOrderDto) => ['answer', 'ready'].includes(kindOf(order));
  // Непрочитанное — самым верхом, группа сильнее «Ждут вас»: клиент приходит сюда узнать новое.
  const fresh = (order: PortalOrderDto) => unread.has(order.id);
  const groups = filter === 'all'
    ? [
      { key: 'new', title: t('orders.v2.groups.new'), list: shown.filter(fresh) },
      { key: 'waiting', title: t('orders.v2.groups.waiting'), list: shown.filter((order) => !fresh(order) && waits(order)) },
      { key: 'rest', title: t('orders.v2.groups.rest'), list: shown.filter((order) => !fresh(order) && !waits(order)) },
    ].filter((group) => group.list.length > 0)
    : [{ key: 'all', title: '', list: shown }];
  return (
    <div className="flex flex-col gap-3">
      {title}
      <div className="flex items-start gap-2">
        {periodMenu}
        <button type="button" aria-label={t('orders.v2.filtersMenu')} aria-haspopup="dialog" aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className={cn(
            'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-[3px] border-solid transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            filter !== 'all' ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink hover:border-ink',
          )}>
          <Funnel className="size-6" />
        </button>
        {periodChip}
        {/* Ряд плашек — от значков, а не от края экрана: иначе при прокрутке он наезжал на них. */}
        <div className="min-w-0 flex-1 [&>[role=group]]:ml-0 [&>[role=group]]:pl-0">{chips}</div>
      </div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen} side="left" title={t('orders.v2.filtersLabel')}>
        <div role="radiogroup" aria-label={t('orders.v2.filtersLabel')} className="flex flex-col gap-1.5">
          {FILTERS.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={filter === key}
              onClick={() => { pickFilter(key); setMenuOpen(false); }}
              className={cn(
                'flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border-0 px-4 text-left text-body font-extrabold',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                filter === key ? 'bg-shop text-on-shop' : 'bg-transparent text-ink hover:bg-sunk',
              )}>
              {t(`orders.v2.filters.${key}`)}
              <span className="tabular-nums">{countOf(key)}</span>
            </button>
          ))}
        </div>
      </Sheet>
      {shown.length === 0 ? nothing : groups.map((group) => (
        <section key={group.key} aria-label={group.title || undefined} className="flex flex-col gap-3">
          {group.title ? <h2 className="m-0 mt-1 text-lead font-extrabold text-ink">{group.title}</h2> : null}
          {group.list.map((order) => <OrderLink key={order.id} order={order} unread={unread.get(order.id)} />)}
        </section>
      ))}
      {pager}
      <OrderStatement />
      <p className="m-0 px-1 text-center text-caption text-ink-muted">{t('orders.v2.payNote')}</p>
    </div>
  );
}
