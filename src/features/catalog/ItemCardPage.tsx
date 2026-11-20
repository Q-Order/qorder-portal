import { lineOf, linesIn, takenIn } from '../cart/cartPart';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PackContents, packMembers } from './PackContents';
import { sizeRow } from './sizeSystem';
import type { SizeGrid as ClothingGrid } from './sizeStandard';
import { ModelArticles } from './ModelArticles';
import { packsOnly, splitOf, tierFor, toPieces } from '../cart/wholesale';
import * as Dialog from '@radix-ui/react-dialog';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, MessageCircle, Package, Ruler, ShieldCheck, Star, Store, Tag, Truck, X } from '../../ui/icons';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  getPortalCatalogItem,
  useGetPortalCatalog,
  useGetPortalCatalogItem,
  useGetPortalCatalogSubstitutes,
  useGetPortalCategories,
  useGetPortalDeliveryOptions,
  type ItemSaleTerms,
  type ShowcaseCardDto,
  type ShowcaseVariantDto,
  type SizeChartDto,
  type CardLineDto,
} from '../../api/generated';
import type { Currency } from '../../shared/currency';
import { fieldText } from './fieldText';
import { CartBar } from '../cart/CartBar';
import { QuantityField } from '../cart/QuantityField';
import { cartOf, useCart, useSetCartLine, useWholesaleLines, useWholesaleMinimum } from '../cart/useCart';
import { LineQuantity } from '../cart/LineQuantity';
import { ModeSwitch, type SaleMode } from '../cart/ModeSwitch';
import { useLockOrderMode } from './OrderModeSwitch';
import { useOrderMode } from '../cart/orderMode';
import { announceAdded } from '../cart/cartDrawer';
import { useAddToCart } from '../cart/ageGate';
import { firstQuantity, fitQuantity, lessQuantity, stepOf } from '../cart/saleTerms';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { RestockButton } from './RestockButton';
import { ReviewsBlock } from '../reviews/ReviewsBlock';
import { PageHelp } from '../shell/HelpGuide';
import { MediaGallery } from './MediaGallery';
import { sizeRowsOf } from './SizeGrid';
import { COLOUR, VariantPicker, axesOf, colourOf, valuesOf } from './VariantPicker';
import { SizeChartTable } from './SizeChartTable';
import { StockNote } from './StockNote';
import { ItemBadges, ItemFacts } from './CatalogPage';
import { DealPrice, MarkBadge, RatingBadge, SaleChannelBadge, TINY_BADGE, WholesaleDealBadge, dealOf, inMode, isWholesaleDeal, PressNote, perPiece, variantsIn } from './itemParts';
import type { ShowcaseCardDtoSizeGuide, ShowcaseItemDto, ShowcaseWholesaleDto } from '../../api/generated';
import { ItemThumb } from './ItemThumb';
import { dayMonth, decimal, money, shortDate } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { fromQuantity, quantityWithUnit, unitPer } from '../../shared/units';
import { intlLocale } from '../../i18n';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { flyToCart } from '../../ui/flyToCart';
import { useBackToSection } from '../../ui/sectionBack';
import { cn } from '../../ui/cn';
import { usePromotions } from '../promotions/usePromotions';

/**
 * Карточка товара: то, за чем сюда приходят с витрины.
 *
 * Открывается по желанию, а не на пути к корзине: закупщик, который знает,
 * что берёт, набирает количество прямо в строке витрины и карточку не видит
 * никогда. Сюда идут за снимками, характеристиками и чужим мнением — и здесь
 * же кладут в корзину, чтобы не возвращаться назад ради одного касания.
 *
 * На мониторе — две колонки, как в макете: снимки слева, решение справа
 * (цена, количество, сумма, «Добавить в корзину» и условия сделки), а под
 * ними двумя панелями — характеристики и отзывы, ниже — похожие товары.
 * Пустого столба под галереей больше нет: длинное — характеристики и
 * отзывы — ушло под обе колонки, а не тянется в одной из них.
 *
 * На телефоне порядок тот же, одной колонкой: снимок во всю ширину, а на него
 * снизу наезжает белый лист с решением. Наезд не украшение: он говорит, что
 * лист прокручивается поверх снимка, и первым экраном человек получает всё,
 * ради чего открывал.
 */
export function ItemCardPage() {
  const { t } = useTranslation();
  const { itemId = '' } = useParams();
  const queryClient = useQueryClient();
  const card = useGetPortalCatalogItem(itemId, { query: { placeholderData: () => variantPreview(queryClient, itemId) } });
  const [orderMode] = useOrderMode();
  // Один и тот же объект, пока не сменились карточка или способ: иначе эффекты по `item.variants` шли на каждой перерисовке.
  const data = card.data?.status === 200 ? card.data.data : undefined;
  const item = useMemo(() => (data ? variantsIn(data, orderMode) : undefined), [data, orderMode]);

  if (card.isPending) {
    return (
      // Бегущий свет, а не мигание: мигающий прямоугольник читается как
      // поломка, а карточку товара открывают по присланной ссылке — то есть
      // на самой медленной связи, какая бывает у клиента.
      <Skeleton data-testid="card-skeleton" className="h-64" />
    );
  }

  if (card.data?.status !== 200) {
    return (
      <div className="flex flex-col items-start gap-4 py-12">
        <p className="text-ink-subtle">
          {t('catalog.gone')}
        </p>
        <Link
          to="/catalog"
          className="inline-flex h-11 items-center gap-2 text-sm font-medium text-ink-muted transition-all duration-300 hover:text-ink active:scale-95"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('catalog.toCatalog')}
        </Link>
      </div>
    );
  }

  // Ключом позиции: выбор другого варианта открывает другую позицию, и набранное
  // количество с формой вопроса начинаются заново.
  return <ItemCard key={card.data.data.id} item={item!} />;
}

/**
 * Выбранный вариант — сразу, как в магазинах одежды: пока его карточка едет, показывается
 * карточка соседа с ценой, наличием и снимками варианта (`ShowcaseVariantDto.media`),
 * а не заглушка. Пришла настоящая — встаёт на место без перерисовки.
 */
function variantPreview(queryClient: QueryClient, itemId: string) {
  for (const [, response] of queryClient.getQueriesData<Awaited<ReturnType<typeof getPortalCatalogItem>>>({
    predicate: (query) => String(query.queryKey[0]).startsWith('/api/portal/catalog/'),
  })) {
    const card = response?.status === 200 ? response.data as ShowcaseCardDto : undefined;
    const variant = card?.variants?.find((entry) => entry.itemId === itemId);
    if (!card || !variant || card.id === itemId) continue;
    return {
      ...response!,
      data: {
        ...card,
        id: itemId,
        price: variant.price,
        oldPrice: variant.oldPrice,
        discountPercent: variant.discountPercent,
        stock: variant.stock,
        available: variant.available,
        fields: variant.fields,
        media: variant.media?.length ? variant.media : card.media,
      },
    } as Awaited<ReturnType<typeof getPortalCatalogItem>>;
  }
  return undefined;
}

/**
 * Снимки цвета, а не размера: у всех размеров одного цвета — фото первого его варианта со снимками,
 * чтобы выбор размера менял только цену (замечание владельца 2026-11-14). Без цвета — первого варианта со снимками.
 */
export function colourMedia(item: ShowcaseCardDto): ShowcaseCardDto['media'] {
  const variants = item.variants ?? [];
  const current = variants.find((variant) => variant.itemId === item.id);
  const colour = axesOf(variants).find((axis) => axis.colour)?.code;
  const tone = (variant: ShowcaseVariantDto) => (colour ? valuesOf(variant).get(colour)?.text : undefined);
  const same = variants.find((variant) => tone(variant) === (current ? tone(current) : undefined) && variant.media?.length);
  return same?.media?.length ? same.media : item.media;
}

function ItemCard({ item }: { item: ShowcaseCardDto }) {
  const { t } = useTranslation();
  const { gallery, decision, beside } = useSpecBeside();
  // Первое фото каждого цвета — заранее, пока смотрят карточку: иначе снимок качался только после нажатия
  // на цвет, и на медленной связи смена цвета занимала около двух секунд (2026-11-20).
  useEffect(() => {
    new Set((item.variants ?? []).map((variant) => variant.media?.find((entry) => entry.kind === 'PHOTO')?.url))
      .forEach((url) => { if (url) new Image().src = url; });
  }, [item.variants]);
  const categories = useGetPortalCategories();
  const category = categories.data?.status === 200
    ? categories.data.data.find((entry) => entry.id === item.categoryId)
    : undefined;

  /*
    Характеристики рубрики и прочие свойства показываются одним списком,
    характеристики — выше. Клиенту разница между ними ничего не объясняет:
    первые продавец завёл шаблоном отрасли и заполняет у каждой позиции,
    вторые — разовое, чему поля не завели. Порядок и есть всё объяснение.

    Характеристика без значения выпадает: строка с подписью и пустотой
    занимает место сообщением ни о чём. Внутренних здесь не бывает вовсе —
    сервер их не отдаёт ни кодом, ни подписью.
  */
  const all = [
    ...(item.fields ?? []).map((field) => (
      { key: `field:${field.code}`, code: field.code, name: field.name, value: fieldText(field), hex: field.hex }
    )),
    ...item.attributes.map((attribute) => (
      { key: `attribute:${attribute.name}`, code: undefined, name: attribute.name, value: attribute.value, hex: undefined }
    )),
  ].filter((property) => property.value.trim() !== '');
  /*
    Без повторов: размер, цвет и прочие оси выбора видны в выборе варианта выше, а «Продаётся
    поштучно» и кратность — пометками под ценой (просьба владельца 2026-11-14).
  */
  const picked = new Set((item.variants?.length ?? 0) >= 2 ? axesOf(item.variants!).map((axis) => axis.code) : []);
  const properties = all.filter((property) => !property.code || !picked.has(property.code));
  const hasSpec = properties.length > 0 || !!item.description;
  // Метки отзыва о размере — только у товара, у которого размер есть.
  const hasSize = all.some((property) => /^(размер|size|өлшем)/i.test(property.name));
  const mode = useSaleMode(item);

  return (
    <div className="flex flex-col gap-6 pb-40 lg:gap-11 lg:pb-0">
      {/*
        Путь обратно — крошками над карточкой, как в макете ПК-К3: «Витрина ›
        рубрика › товар». Карточку открывают и по присланной ссылке, и тогда
        крошки — единственный ответ на вопрос, из какой она рубрики.
      */}
      {/* «Оптом / В розницу» — на уровне крошек, справа (просьба владельца 2026-11-20); на телефоне крошек нет — один переключатель. */}
      <div className={cn('flex items-center gap-4 lg:-mb-5', !mode.value && 'max-md:hidden')}>
      <nav aria-label={t('item.crumbs')} className="hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm text-ink-muted md:flex">
        <Link to="/home" className="hover:text-ink">{t('home.title')}</Link>
        <span aria-hidden="true">›</span>
        <Link to={category ? `/catalog?category=${encodeURIComponent(category.id)}` : '/catalog'} className="hover:text-ink">
          {category?.name ?? t('catalog.title')}
        </Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page" className="min-w-0 truncate font-bold text-ink">{item.name}</span>
      </nav>
      {mode.value && item.wholesale ? (
        <ModeSwitch value={mode.value} onChange={mode.change} className="w-full shrink-0 md:ml-auto md:w-64"
          // И сразу к блоку о выбранном: цене штуки или условиям опта (2026-10-30) — когда он отрисуется.
          onPick={(next) => setTimeout(() => showBlockOf(next))} />
      ) : null}
      </div>

      {/*
        Три части одной сеткой: снимки, решение и характеристики. На мониторе
        снимки и решение стоят рядом, а характеристики — под ними во всю ширину:
        под одними снимками справа оставалась пустота (просьба владельца 2026-11-13).
        Если решение заметно выше снимков (оптовые цены), пустота была бы уже слева —
        тогда характеристики встают под снимки (`useSpecBeside`);
        на телефоне всё идёт подряд — снимки, решение, характеристики.
        Панель одна: две копии для двух ширин диктор прочёл бы дважды.
      */}
      <section className="flex flex-col lg:grid lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-5">
        {/*
          Отрицательные поля гасят отступы оболочки: на телефоне снимок идёт
          от края до края, иначе он читался бы картинкой внутри карточки,
          а не подложкой страницы.
        */}
        {/*
          Характеристики под снимком (`beside`) — одной левой колонкой, которая держится под шапкой,
          пока листается длинная правая часть (таблица размеров, ступени опта): иначе слева
          оставалась пустота (просьба владельца 2026-11-14). На телефоне колонки нет — `contents`.
        */}
        <div className={cn('contents', beside && 'lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-5 lg:self-start')}>
        <div ref={gallery} className="-mx-4 -mt-4 md:mx-0 md:mt-0 lg:col-start-1 lg:row-start-1">
          <MediaGallery
            media={colourMedia(item)}
            itemName={item.name}
            topLeft={(
              <div className="flex items-start gap-2">
                <BackCircle />
                <PageHelp className="size-11 rounded-full border-0 bg-surface/85 backdrop-blur md:hidden [&_svg]:size-5" />
                <PhotoStickers item={item} />
              </div>
            )}
            bottomLeft={<PhotoBadges item={item} />}
            topRight={(
              <FavoriteButton
                itemId={item.id}
                favorite={item.favorite}
                // На снимке кнопка держится полупрозрачной подложкой, а не
                // рамкой: рамка на светлом кадре пропадает, а на тёмном
                // выглядит вырезанной дырой.
                className="size-12 rounded-full border-transparent bg-surface/85 backdrop-blur"
              />
            )}
          />
        </div>
        {hasSpec && beside && (
          <div className="flex flex-col gap-4">
            <SpecPanel item={item} properties={properties} wide={false} />
          </div>
        )}
        </div>

        <div ref={decision} className={cn('lg:col-start-2 lg:row-start-1', beside && 'lg:row-span-2')}>
          <Decision item={item} categoryName={category?.name} />
        </div>

        {hasSpec && !beside && (
          <div className="mt-5 flex flex-col gap-4 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:mt-0">
            <SpecPanel item={item} properties={properties} wide />
          </div>
        )}
      </section>

      {item.stock === 'OUT_OF_STOCK' ? <Substitutes itemId={item.id} /> : null}

      <ReviewsBlock
        itemId={item.id}
        canReview={item.canReview}
        sizeTags={hasSize}
        purchase={{ orderNumber: item.purchaseOrderNumber, at: item.purchasedAt }}
      />

      {item.categoryId && <Similar itemId={item.id} categoryId={item.categoryId} categoryName={category?.name} />}

      {/* На телефоне корзину зовёт панель покупки — плавающая кнопка легла бы на неё. */}
      <div className="max-lg:hidden"><CartBar /></div>
    </div>
  );
}

/**
 * Правая колонка: всё, из чего складывается решение купить.
 *
 * Сверху вниз — что это (рубрика, оценка, название), почём (цена, старая
 * цена и выгода, налог и дата), сколько и во что обойдётся (количество
 * и сумма), само действие и условия сделки. Порядок совпадает с тем,
 * в каком человек задаёт себе эти вопросы.
 */
function Decision({ item, categoryName }: { item: ShowcaseCardDto; categoryName?: string }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const navigate = useNavigate();
  // Вопрос о товаре — в переписку: там и прежние разговоры о нём, и новый вопрос.
  const ask = () => navigate(`/questions?item=${encodeURIComponent(item.id)}`);
  const mode = useSaleMode(item);
  // Своя цена клиента приходит без опта, скидка клиента — с оптом со скидкой: режим решает сам опт (2026-11-15).
  const only: SaleMode | undefined = item.wholesale?.retail ? undefined : item.wholesale ? 'WHOLESALE' : 'RETAIL';
  useLockOrderMode(only);
  // Цена, условия и распродажа — выбранной заявки: в «Оптом» опт, в «В розницу» розница (2026-11-06).
  const view = inMode(item, mode.value);
  // Пресс — цена за штуку крупно, цена пресса строкой ниже (решение владельца 2026-11-14).
  const priced = perPiece(view);
  // Одежда оптом — линейкой: размер не выбирают, состав линейки — описанием (решение владельца 2026-11-14).
  const line = (mode.value ?? only) === 'WHOLESALE' ? item.line : undefined;

  // Налог — отдельной мелкой строкой под ценой. «Цена на <дата>» убрана (просьба владельца 2026-11-06).
  const terms = item.vatRate != null
    ? t(item.vatIncluded ? 'catalog.vatIncluded' : 'catalog.vat', { rate: decimal(item.vatRate) })
    : '';

  // Подложка пилюли — единственное, что решается здесь; чем «наличие
  // уточняется» отличается от «нет в наличии», знает StockNote.
  // «Свободно: N» — в единицах выбранной заявки (просьба владельца 2026-11-15): одежда оптом — полными
  // линейками (по самому скудному размеру), розница — штуками открытого размера. Голое «6» читалось двояко.
  const inLines = !!line && line.availableLines != null && item.available != null;
  const free = inLines ? line.availableLines : item.available;
  const freeText = free == null ? undefined
    // Линейка — несколько штук размерного ряда: рядом штуки всех линеек, «6 линеек (18 шт.)» — иначе неясно, много ли это.
    : inLines ? `${t('cart.lines.unitCount', { count: free })} (${quantityWithUnit(free * line.pieces, item.wholesale?.pieceUnit ?? item.unit)})`
      : quantityWithUnit(free, item.unit);
  const stockTint = (free != null ? free > 0 : item.stock === 'IN_STOCK')
    ? 'bg-in-stock/10'
    : item.stock === 'UNKNOWN'
      ? 'bg-unclear/10'
      : 'bg-canvas';
  const unitNote = (
    <span className="text-sm font-semibold text-ink-muted md:text-base">
      {t('catalog.priceNote.perUnit', { unit: unitPer(priced.unit) })}
    </span>
  );
  const savingChip = view.oldPrice != null ? (
    <span className="ml-1.5 flex h-7 items-center self-center rounded-[var(--radius-pill)] bg-sale-soft px-2.5 text-sm font-extrabold text-sale-ink first-letter:uppercase">
      {t('catalog.saving', { amount: money(view.oldPrice - view.price, currency) })}
    </span>
  ) : null;
  const stockKnown = item.available != null || item.stock != null;
  const noveltySince = item.terms?.noveltySince
    ? shortDate(`${item.terms.noveltySince}T12:00:00`)
    : null;

  return (
    <div
      className={cn(
        // Лист наезжает на снимок на те же 20 точек, на которые скруглён:
        // скругление без наезда выглядело бы обрезанным углом.
        'relative z-10 -mx-4 -mt-5 flex flex-col gap-4 rounded-[calc(var(--radius-tile)*1.25)] bg-surface px-4 pb-5 pt-5',
        // Лист и заканчивается как лист (замечание владельца 2026-11-06): белое обрывалось
        // прямо под «Спросить продавца» — теперь отступ, скруглённый низ и мягкая тень по краю.
        'shadow-[0_10px_24px_-12px_rgba(58,48,30,.18)]',
        'md:mx-0 md:mt-5 md:gap-[22px] md:rounded-none md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:shadow-none lg:mt-0',
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-caption">
          {categoryName && (
            <span className="flex h-[30px] items-center rounded-[var(--radius-pill)] bg-accent-soft px-3 font-bold text-accent-ink">{categoryName}</span>
          )}
          {item.terms?.novelty && (
            <span className="flex h-[30px] items-center rounded-[var(--radius-pill)] bg-surface px-3 font-bold text-ok-ink shadow-[0_0_0_1px_var(--color-hairline)]">
              {noveltySince ? t('item.novelSince', { date: noveltySince }) : t('catalog.badge.new')}
            </span>
          )}
          {/*
            Оценка — ссылкой к отзывам: число без отзывов за ним ничего
            не объясняет. Сравнение с null обязательно: незаполненную оценку
            сервер присылает значением null, а не отсутствием ключа.
          */}
          <a
            href="#reviews"
            data-testid="item-rating"
            className="flex h-[30px] items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface px-3 font-bold text-ink shadow-[0_0_0_1px_var(--color-hairline)] hover:shadow-[0_0_0_1px_var(--color-line)]"
          >
            <Star aria-hidden="true" className={cn('size-[15px]', item.rating != null ? 'fill-star text-star' : 'text-ink-faint')} />
            {item.rating != null
              ? `${item.rating.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${
                item.reviewCount != null ? ` · ${t('item.reviews', { count: item.reviewCount })}` : ''}`
              : t('item.noReviews')}
          </a>
        </div>
        {/* «Как пользоваться» на мониторе — у названия товара; на телефоне она на фото (выше). */}
        <div className="flex items-start gap-3">
          <h1 className="min-w-0 flex-1 text-title font-extrabold leading-tight tracking-[-0.02em] text-ink md:text-display lg:text-hero lg:font-black lg:leading-[1.05] lg:tracking-[-0.03em]">
            {item.name}
          </h1>
          <PageHelp className="shrink-0 max-md:hidden" />
        </div>
        {/* Артикулы цветов модели — как «Арт.» у Спортмастера: открытый цвет первым (решение владельца 2026-11-14). */}
        <ModelArticles item={item} />
      </div>

      <div className="flex flex-col gap-1.5">
        {/*
          Цена, единица, старая цена и выгода — одной строкой на общей базовой
          линии, как в макете: «2 500 тенге» без «за мешок» ничего не значит там,
          где рядом лежит цена за тонну. Цифры табличные, чтобы цена не дёргалась.
        */}
        <div data-testid="item-price" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/* Скидка: старая цена зачёркнута красной линией, новая — зелёным под ней (2026-10-30).
              «за кг» и выгода — справа от новой цены: снаружи блока скидки они вставали
              на базовую линию зачёркнутой цены и висели над ценой. */}
          {dealOf(priced) ? (
            <DealPrice item={priced} oldSize="text-base md:text-xl"
              size="text-display leading-none md:text-hero lg:text-jumbo lg:font-black lg:tracking-[-0.03em]"
              note={<>{unitNote}{savingChip}</>} />
          ) : null}
          {/* У скидки опта своя подпись внутри DealPrice, note она не берёт — выгода рядом. */}
          {dealOf(priced)?.wholesale ? savingChip : null}
          {dealOf(priced) ? null : (
            <>
              <span className="text-display font-extrabold tabular-nums leading-none tracking-[-0.02em] text-ok-ink md:text-hero lg:text-jumbo lg:font-black lg:tracking-[-0.03em]">
                {money(priced.price, currency)}
              </span>
              {unitNote}
              {savingChip}
            </>
          )}
        </div>
        <PressNote press={priced.press} className="text-sm" />
        {item.yourPrice ? (
          <p data-testid="item-your-price" className="text-sm font-semibold text-accent">{t('catalog.yourPriceNote')}</p>
        ) : null}
        {terms && <p className="text-sm text-ink-subtle">{terms}</p>}
      </div>

      {/* Акция того вида, в котором смотрят карточку: у «только опт» — оптовая, даже если каталог в «В розницу». */}
      {view.discountPercent ? <SaleParticipation mode={mode.value ?? only} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        {stockKnown && (
          <span
            data-testid="stock-pill"
            className={cn('inline-flex h-[34px] items-center rounded-[var(--radius-pill)] px-3 [&>span]:mt-0', stockTint)}
          >
            <StockNote stock={item.stock} available={free} amount={freeText} />
          </span>
        )}
        {item.stock === 'OUT_OF_STOCK' ? <RestockButton itemId={item.id} /> : null}
        <ItemFacts item={view} pills />
      </div>

      {/*
        Покупка — панелью, как в макете: количество с суммой, главное действие
        и два второстепенных — вопрос продавцу и избранное.
      */}
      <div className="flex flex-col gap-[18px] md:rounded-[var(--radius-gallery)] md:bg-surface md:p-5 md:shadow-[0_0_0_1px_var(--color-hairline)]">
        {(item.variants ?? []).length > 1 && (
          <VariantPicker
            itemId={item.id}
            variants={item.variants}
            grid={gridOf(item)}
            sizeAction={item.sizeGuide && <SizeGuide kind={item.sizeGuide} onAsk={ask} chart={item.sizeChart} grid={gridOf(item)} />}
            chart={item.sizeChart}
            hideSizes={!!item.line && (mode.value ?? (item.wholesale?.retail ? undefined : 'WHOLESALE')) === 'WHOLESALE'}
          />
        )}
        {line ? (
          <LineInfo line={line} currency={currency} chart={item.sizeChart} grid={gridOf(item)} retail={!!item.wholesale?.retail}
            guide={item.sizeGuide && <SizeGuide kind={item.sizeGuide} onAsk={ask} chart={item.sizeChart} grid={gridOf(item)} />} />
        ) : null}
        {item.pack ? <PackContents label={t('pack.inPress')} members={packMembers(item.pack)} /> : null}
        <Purchase item={item} mode={mode.value} />
      </div>

      <DealFacts />

      {/*
        Вопрос продавцу и избранное — под условиями, как в макете ПК-К3:
        на мониторе ссылками, на телефоне — двумя кнопками под пальцем.
      */}
      <div className="grid grid-cols-2 gap-2.5 lg:flex lg:gap-7">
        <button
          type="button"
          onClick={ask}
          className={cn(GHOST, LINK)}
        >
          <MessageCircle aria-hidden="true" className="size-5" />
          {t('questions.ask')}
        </button>
        <FavoriteButton itemId={item.id} favorite={item.favorite} labelled className={cn(GHOST, 'size-auto', LINK)} />
      </div>

      <DiscountsPanel item={item} />
    </div>
  );
}

/**
 * Силуэт спереди — один на все мерки: меняется только лента на нём.
 * Правая половина зеркалит левую, чтобы фигура не кривилась.
 */
const SILHOUETTE = (() => {
  const right: [number, number][] = [
    [35, 17], [46, 22], [50, 48], [47, 60], [44, 46], [42, 30],
    [40, 46], [43, 60], [41, 112], [34, 112], [32, 72],
  ];
  const left = right.slice(0, -1).reverse().map(([x, y]) => [64 - x, y] as [number, number]);
  return `M${[...right, ...left].map(([x, y]) => `${x} ${y}`).join(' L')} Z`;
})();

/** Стопа сверху: пятка внизу, носок вверху. */
const FOOT = 'M32 6 C44 6 50 16 50.5 32 C51 46 47 58 45.5 74 C44 90 44.5 104 41 110 C38.5 114.5 25.5 114.5 23 110 C19.5 104 20 90 18.5 74 C17 58 13 46 13.5 32 C14 16 20 6 32 6 Z';

/** Какую фигуру мерить: одежду — на силуэте, обувь — по стопе, головной убор — по голове. */
type SizeGuideKind = ShowcaseCardDtoSizeGuide;

/** Мерки каждого вида — в порядке, в каком их снимают. */
const STEPS = {
  CLOTHING: ['chest', 'waist', 'hips', 'inseam'],
  SHOES: ['footLength', 'footWidth'],
  HEADWEAR: ['head'],
} as const satisfies Record<SizeGuideKind, readonly string[]>;

type MeasureStep = (typeof STEPS)[SizeGuideKind][number];

/** Мерка таблицы продавца → шаг подсказки: при таблице одежды объясняем только то, что в ней есть. */
const STEP_OF_MEASURE: Partial<Record<string, MeasureStep>> = { CHEST: 'chest', WAIST: 'waist', HIPS: 'hips', INSEAM: 'inseam' };

/** Вступление к меркам: у каждого вида своё — стопу мерят вечером, голову без шапки. */
const INTRO: Record<SizeGuideKind, string> = {
  CLOTHING: 'intro',
  SHOES: 'shoesIntro',
  HEADWEAR: 'headwearIntro',
};

/** Где лежит лента: отрезок от точки до точки на фигуре 64×120. */
const TAPES: Record<MeasureStep, [number, number, number, number]> = {
  chest: [20, 34, 44, 34],
  waist: [22, 46, 42, 46],
  hips: [19, 60, 45, 60],
  inseam: [33.5, 76, 35.5, 108],
  footLength: [32, 8, 32, 112],
  footWidth: [13, 36, 51, 36],
  head: [11, 44, 53, 44],
};

/** Фигура под лентой. Контур — токенами, как и лента. */
function Figure({ kind }: { kind: SizeGuideKind }) {
  const outline = 'fill-surface stroke-ink-faint';
  if (kind === 'SHOES') {
    return <path d={FOOT} className={outline} strokeWidth="1.5" strokeLinejoin="round" />;
  }
  if (kind === 'HEADWEAR') {
    return (
      <>
        {/* Шея начинается под головой, а голова рисуется поверх: стык без зазора. */}
        <path d="M25 72 V92 C25 98 14 101 8 116 M39 72 V92 C39 98 50 101 56 116" className="fill-none stroke-ink-faint" strokeWidth="1.5" />
        <ellipse cx="32" cy="54" rx="21" ry="27" className={outline} strokeWidth="1.5" />
        <path d="M11 52 C7 52 7 62 11.5 62 M53 52 C57 52 57 62 52.5 62" className="fill-none stroke-ink-faint" strokeWidth="1.5" />
      </>
    );
  }
  return (
    <>
      <circle cx="32" cy="10" r="6.5" className="fill-none stroke-ink-faint" strokeWidth="1.5" />
      <path d={SILHOUETTE} className={outline} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}

/**
 * Схема мерки: где приложить ленту. Картинка повторяет текст рядом,
 * поэтому скрыта от скринридера; цвета — токенами, и схема сама
 * перекрашивается в тёмной теме и в цвет магазина.
 */
function MeasureSchema({ kind, step, large = false }: { kind: SizeGuideKind; step: MeasureStep; large?: boolean }) {
  const [x1, y1, x2, y2] = TAPES[step];
  // Засечки на концах ленты — поперёк неё, по три точки в каждую сторону.
  const length = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / length) * 3;
  const ny = ((x2 - x1) / length) * 3;
  return (
    <svg
      aria-hidden="true"
      data-testid={`size-schema-${step}`}
      data-size={large ? 'large' : 'small'}
      viewBox="0 0 64 120"
      className={cn(
        'shrink-0 rounded-[var(--radius-control)] bg-sunk motion-safe:transition-[width,height] motion-safe:duration-200',
        large ? 'h-40 w-[5.35rem]' : 'h-[5.5rem] w-12',
      )}
    >
      <Figure kind={kind} />
      <g className="stroke-accent" strokeWidth="2.25" strokeLinecap="round">
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <line x1={x1 - nx} y1={y1 - ny} x2={x1 + nx} y2={y1 + ny} />
        <line x1={x2 - nx} y1={y2 - ny} x2={x2 + nx} y2={y2 + ny} />
      </g>
    </svg>
  );
}

/**
 * «Как подобрать размер» — ссылкой у выбора размера и окном с подсказкой.
 *
 * Подсказка общая, а не таблица размеров: размерной сетки продавец
 * не заводит, и выдуманные сантиметры были бы хуже никаких. Окно учит
 * снять мерки и отправляет с сомнением к продавцу — тот знает свою
 * посадку. Radix-диалог, как у проверки 21+: ловушка фокуса, Esc
 * и возврат фокуса на ссылку — даром.
 *
 * Что мерить, решает сервер по отрасли рубрики (`sizeGuide`): у обуви —
 * стопу, у головного убора — голову. Без его ответа подсказки нет вовсе:
 * мерки одежды у кроссовок учили бы не тому.
 */
/**
 * Что входит в одну линейку — справкой в «Оптом»: размеры со штуками и цена линейки.
 * Размер здесь не выбирают — оптом одежда только линейкой; таблица размеров — ссылкой рядом.
 */
// Сетка модели (WOMEN/MEN/UNISEX) — от сервера по полю «Для кого»; у детского и не одежды пусто.
const gridOf = (item: ShowcaseCardDto) => item.sizeGrid as ClothingGrid | undefined;

function LineInfo({ line, currency, guide, chart, grid, retail }: {
  line: CardLineDto; currency: Currency | undefined; guide?: ReactNode; chart?: SizeChartDto; grid?: ClothingGrid; retail: boolean;
}) {
  const { t } = useTranslation();
  // Таблицей сразу в трёх системах — RUS, INT, EUR (просьба владельца 2026-11-14). Столбца, где нет
  // ни одного значения ни у продавца, ни по сетке, нет.
  const rows = line.sizes.map((size) => sizeRow(size.label, chart, grid));
  const systems = (['RUS', 'INT', 'EUR'] as const).filter((system) => system === 'RUS' || rows.some((row) => row[system]));
  const cell = 'px-2.5 py-1.5 text-center whitespace-nowrap';
  return (
    <section aria-label={t('item.line.title')} data-testid="card-line"
      className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-sunk p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-body font-bold text-ink">{t('item.line.title')}</h2>
        {guide}
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-small)] bg-surface shadow-[0_0_0_1px_var(--color-hairline)]">
        <table className="w-full border-collapse text-sm tabular-nums" data-testid="card-line-table">
          <caption className="sr-only">{t('item.line.tableCaption', { systems: systems.join(', ') })}</caption>
          <thead>
            <tr className="bg-sunk text-caption font-bold text-ink-muted">
              {systems.map((system) => <th key={system} scope="col" className={cell}>{system}</th>)}
              <th scope="col" className={cn(cell, 'text-right')}>{t('item.line.inLine')}</th>
            </tr>
          </thead>
          <tbody>
            {line.sizes.map((size, row) => (
              <tr key={size.label} className={cn('border-t border-hairline', size.missing ? 'text-ink-subtle' : 'text-ink')}>
                {systems.map((system, index) => {
                  const value = rows[row][system] ?? '—';
                  return index === 0 ? (
                    <th key={system} scope="row" className={cn(cell, 'font-extrabold', size.missing && 'line-through')}>{value}</th>
                  ) : (
                    <td key={system} className={cn(cell, size.missing && 'line-through')}>{value}</td>
                  );
                })}
                <td className={cn(cell, 'text-right font-semibold')}>
                  {size.missing ? t('item.line.missing') : t('item.line.pieces', { count: size.quantity })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-sm text-ink">
        {t('item.line.price', { pieces: line.pieces, price: money(line.linePrice, currency) })}
      </p>
      {/* «Отдельные размеры — в розницу» — только если товар в розницу продаётся (2026-11-15). */}
      <p className="m-0 text-caption text-ink-muted">{t(retail ? 'item.line.rule' : 'item.line.ruleOnly')}</p>
    </section>
  );
}

function SizeGuide({ kind, onAsk, chart, grid }: { kind: SizeGuideKind; onAsk: () => void; chart?: SizeChartDto; grid?: ClothingGrid }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Мелкая схема рядом с текстом читается с трудом: нажатая мерка показывает
  // свою крупно. Крупной бывает одна за раз — иначе окно ушло бы в прокрутку.
  const [enlarged, setEnlarged] = useState<MeasureStep | null>(null);
  // У куртки с таблицей «грудь, талия, рост» не учим мерить бёдра и шаговый шов (QA 2026-11-14).
  const steps: readonly MeasureStep[] = kind === 'CLOTHING' && chart
    ? STEPS.CLOTHING.filter((step) => chart.rows.some((row) => STEP_OF_MEASURE[row.measure] === step))
    : STEPS[kind];
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="qo-hit inline-flex min-h-8 items-center gap-1.5 text-sm font-bold text-accent-ink underline-offset-[3px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Ruler aria-hidden="true" className="size-4" />
          {chart ? t('item.sizeChart.link') : t('item.sizeGuide.link')}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/45 dark:bg-black/60" />
        <Dialog.Content
          aria-describedby={steps.length > 0 ? 'size-guide-text' : undefined}
          className={cn(
            'qo-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2',
            chart ? 'w-[min(48rem,calc(100vw-2rem))]' : 'w-[min(28rem,calc(100vw-2rem))]',
            'flex-col gap-3 overflow-y-auto rounded-[calc(var(--radius-gallery)*7/6)] bg-surface p-6 shadow-float',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-xl font-extrabold tracking-[-0.02em] text-ink">
              {chart ? t('item.sizeChart.title') : t('item.sizeGuide.title')}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t('item.sizeGuide.close')}
              className="-mr-2 -mt-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          {/* Таблица размеров модели от продавца — над «как определить размер» (2026-11-14). */}
          {chart ? <SizeChartTable chart={chart} grid={grid} /> : null}
          {chart && steps.length > 0 ? <h3 className="m-0 mt-2 text-lead font-extrabold text-ink">{t('item.sizeChart.howTo')}</h3> : null}
          {steps.length > 0 ? <p id="size-guide-text" className="text-body leading-normal text-ink-muted">{t(`item.sizeGuide.${INTRO[kind]}`)}</p> : null}
          {/*
            Окно с раскрытой меркой обязано помещаться без прокрутки: строки
            разделяет их собственная подсветка, а не промежуток, и крупная
            схема ровно такая, чтобы уложиться в экран ноутбука.
          */}
          <ul className="flex flex-col gap-1">
            {steps.map((step) => (
              <li key={step}>
                <button
                  type="button"
                  aria-expanded={enlarged === step}
                  onClick={() => setEnlarged((current) => (current === step ? null : step))}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3.5 rounded-[var(--radius-control)] px-2 py-1 text-left text-body leading-snug hover:bg-sunk/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <MeasureSchema kind={kind} step={step} large={enlarged === step} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <b className="text-ink">{t(`item.sizeGuide.${step}`)}</b>
                    <span className="text-ink-muted">{t(`item.sizeGuide.${step}How`)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="rounded-[var(--radius-control)] bg-sunk px-3.5 py-3 text-sm font-semibold text-ink">{t('item.sizeGuide.doubt')}</p>
          <Button
            size="lg"
            variant="accent"
            className="gap-2"
            onClick={() => {
              // Та же форма, что у кнопки «Спросить продавца» ниже, — не вторая
              // копия в окне: вопрос о размере продавец получит с названием
              // позиции, как любой другой. Фокус Radix вернёт на ссылку,
              // а форма раскроется под кнопками покупки.
              setOpen(false);
              onAsk();
            }}
          >
            <MessageCircle aria-hidden="true" className="size-5" />
            {t('questions.ask')}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Второстепенная кнопка карточки: вопрос продавцу и избранное. */
const GHOST = cn(
  'inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-[var(--radius-tile)] px-3 py-1 text-center text-base font-semibold leading-[1.15] text-ink',
  'shadow-[0_0_0_1px_var(--color-line)] transition-colors duration-200 hover:bg-sunk',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

/**
 * Метки на снимке мелко — как на плитке (решение владельца 2026-10-30): сам товар должен быть виден.
 * Сверху, рядом с «назад», — 21+ и наклейка «−N%»; снизу слева — признаки и под ними как продаётся.
 */
function PhotoStickers({ item: card }: { item: ShowcaseCardDto }) {
  const { t } = useTranslation();
  // Наклейки выбранной заявки: распродажа розницы не висит на оптовой цене, и наоборот.
  // Товар одного способа не слушает «Оптом / В розницу» в шапке — у него свой способ (2026-11-14).
  const item = inMode(card, useSaleMode(card).value);
  if (!item.terms?.ageRestricted && !item.discountPercent) return null;
  return (
    <div className="flex gap-1 pt-1">
      {item.terms?.ageRestricted && <span className={cn(TINY_BADGE, 'bg-adult text-white')}>{t('catalog.badge.adult', { age: item.terms?.minAge ?? 21 })}</span>}
      {item.discountPercent ? <span data-testid="discount-sticker" className={cn(TINY_BADGE, 'bg-sale text-on-sale')}>−{item.discountPercent}%</span> : null}
    </div>
  );
}

function PhotoBadges({ item: card }: { item: ShowcaseCardDto }) {
  const { t } = useTranslation();
  // Метки выбранной заявки: в «Оптом» — «Оптом», без «Скидки» на опт против розницы.
  // Товар одного способа не слушает «Оптом / В розницу» в шапке — у него свой способ (2026-11-14).
  const item = inMode(card, useSaleMode(card).value);
  const terms = item.terms;
  // Цвет и значок признака — те же, что у фильтров каталога и меток на плитке.
  return (
    <div className="flex flex-col items-start gap-0.5">
      {terms?.hit && <MarkBadge mark="hit" className={TINY_BADGE}>{t('catalog.badge.hit')}</MarkBadge>}
      {isWholesaleDeal(item) && <WholesaleDealBadge item={item} />}
      {terms?.novelty && <MarkBadge mark="novelty" className={TINY_BADGE}>{t('catalog.badge.new')}</MarkBadge>}
      {item.discountPercent ? <MarkBadge mark="promo" className={TINY_BADGE}>{t('catalog.badge.sale')}</MarkBadge> : null}
      {/* Как продаётся — и в карточке, как на плитке. */}
      <SaleChannelBadge item={item} className={TINY_BADGE} />
    </div>
  );
}

/**
 * Количество, сумма и «Добавить в корзину».
 *
 * Пока позиции нет в корзине, количество набирается здесь же, до нажатия:
 * сумма считается сразу, и человек видит, во что обойдётся набранное, раньше,
 * чем нажмёт. Первым стоит допустимое количество — минимум продавца, поднятый
 * до кратности, — а не ноль: «Сумма 0 тенге» читалась бы поломкой.
 *
 * Положенная позиция дальше правится тем же счётчиком, что на витрине
 * и в корзине, — прямо в корзине, — а вместо кнопки встаёт «Добавлено»
 * со ссылкой в корзину.
 */
/** На мониторе второстепенное действие — ссылкой без рамки, как в макете ПК-К3. */
const LINK = 'lg:min-h-0 lg:border-transparent lg:px-0 lg:py-1 lg:text-sm lg:font-extrabold lg:shadow-none lg:hover:bg-transparent lg:hover:text-accent-ink';

/**
 * Панель покупки на телефоне — над нижним меню, как в макете карточки:
 * количество, сумма и главное действие под пальцем, сколько ни листай
 * характеристики и отзывы. На мониторе — обычный блок в колонке решения.
 */
// На телефоне — одной строкой (макет К2.3): количество и кнопка с суммой.
const PHONE_BAR = cn(
  // Телефон: кнопка — отдельной строкой во всю ширину; в строку со счётчиком «В корзину · сумма» обрезалось до «В кор…».
  // Монитор: счётчик и сумма — одной группой, кнопка рядом; не помещается (1024 лёжа) — кнопка своей строкой
  // во всю ширину, а не сумма под счётчиком (QA 2026-11-15).
  'flex flex-col items-stretch gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-3',
  // Не прибита к низу: на телефоне прокручивается вся страница (решение владельца 2026-11-04).
);

/**
 * «В розницу / Оптом» в карточке — только у позиции «и розница, и опт» без своей цены клиента
 * (иначе выбора нет, backend.md §18.32). Режим общий с каталогом и корзиной. Смена лишь открывает
 * другую заявку: лежащее в оптовой остаётся в оптовой, в розничной — в розничной (решение владельца 2026-11-06).
 */
/** Долистать к блоку режима: опт — условия опта, розница — цена. */
function showBlockOf(mode: SaleMode) {
  document.querySelector(mode === 'WHOLESALE' ? '[data-testid="wholesale-terms"]' : '[data-testid="item-price"]')
    ?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

function useSaleMode(item: ShowcaseCardDto) {
  // Режим — общий с каталогом и корзиной («Вариант Б»: оптовая и розничная заявки раздельно).
  const [chosen, setChosen] = useOrderMode();
  const choice = !!item.wholesale?.retail;
  return { value: choice ? chosen : undefined, change: setChosen };
}

function Purchase({ item, mode }: { item: ShowcaseCardDto; mode?: SaleMode }) {
  // Одежда оптом — линейками (решение владельца 2026-11-14): своя покупка, без штучного счётчика.
  const lineTier = item.wholesale?.linePieces && (mode === 'WHOLESALE' || !item.wholesale.retail)
    ? item.wholesale.tiers[0] : undefined;
  if (lineTier) return <LinePurchase item={item} from={lineTier.from} />;
  return <PiecePurchase item={item} mode={mode} />;
}

/** Покупка линейкой: «В корзину» кладёт первую ступень линеек, дальше — счётчик линеек. */
function LinePurchase({ item, from }: { item: ShowcaseCardDto; from: number }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const cart = cartOf(useCart().data);
  const { add, isPending } = useAddToCart();
  const taken = linesIn(cart, item.id);
  const setLines = useWholesaleLines();
  // Выбранный вариант до корзины; в корзине выбор сразу меняет число линеек.
  const [wanted, setWanted] = useState(from);
  const pick = (lines: number) => (taken > 0 ? setLines.mutate({ itemId: item.id, data: { lines } }) : setWanted(lines));
  const chosen = taken > 0 ? taken : wanted;
  const choices = lineChoices(item);
  // Сумма — как у штучной покупки: до корзины — первая ступень линеек, в корзине — строки этой линейки.
  const linePrice = item.line?.linePrice ?? item.wholesale?.tiers[0]?.price ?? 0;
  const inCart = (cart?.lines ?? []).filter((one) => one.line?.sizes.some((size) => size.itemId === item.id))
    .reduce((sum, one) => sum + (one.total ?? 0), 0);
  // Только полные линейки: каждого размера должно хватить на все линейки (требование 2026-11-15).
  const available = item.line?.availableLines;
  const short = available != null && available < Math.max(from, taken > 0 ? 0 : wanted);
  return (
    <div className="flex flex-col gap-3" data-testid="line-purchase">
      {choices.length > 0 ? <LineTiers item={item} choices={choices} chosen={chosen} onPick={pick} maxLines={available} /> : null}
      {available != null ? (
        <p data-testid="line-available" className={cn('m-0 text-sm font-semibold', short ? 'text-ink' : 'text-ink-muted')}>
          {available === 0 ? t('item.line.none')
            : available < from ? t('item.line.belowMin', { count: available, from })
            : t('item.line.available', { count: available })}
        </p>
      ) : null}
      {taken > 0 ? (
        <div data-purchase-bar="" className={PHONE_BAR}>
          <LineQuantity itemId={item.id} minLines={from} maxLines={available} className="lg:w-[14rem]" />
          <Link to="/checkout" className="flex h-13 w-full min-w-0 items-center justify-center gap-2.5 rounded-[1rem] bg-accent px-3 text-body font-bold text-on-accent no-underline hover:opacity-90 lg:w-auto lg:px-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            {t('item.inCartSum', { sum: money(inCart, currency) })}
          </Link>
        </div>
      ) : (
        <Button variant="accent" size="xl" disabled={isPending || short}
          className="h-13 w-full gap-2 rounded-[1rem] text-body lg:h-14"
          onClick={async (event) => {
            const shot = document.querySelector('[data-testid="gallery-photo"]') ?? event.currentTarget;
            const added = await add(item, wanted, 'WHOLESALE');
            if (added) flyToCart(shot);
          }}>
          {t('cart.lines.toCart')} · {money(choices.find((one) => one.lines === wanted)?.sum ?? linePrice * wanted, currency)}
        </Button>
      )}
    </div>
  );
}

interface LineChoice {
  /** Сколько линеек */
  lines: number;
  /** Штук во всех линейках */
  pieces: number;
  /** Цена штуки по ступени этого числа линеек */
  piece: number;
  /** Цена одной линейки по этой ступени */
  line: number;
  /** Сумма за все линейки */
  sum: number;
  /** Цена линейки до распродажи опта; пусто — распродажи нет */
  oldLine?: number;
}

/**
 * Варианты покупки линейками — как прежние ступени опта у штучного товара (просьба владельца 2026-11-14):
 * ступени продавца, а если их меньше трёх — дополняются 1, 3 и 5 линейками по действующей ступени.
 * Цены — от цены линейки карточки (`item.line`): в ней уже распродажа и недостающие размеры.
 */
function lineChoices(item: ShowcaseCardDto): LineChoice[] {
  const wholesale = item.wholesale;
  const first = wholesale?.tiers[0];
  if (!wholesale || !first || first.price <= 0) return [];
  const counts = new Set(wholesale.tiers.map((tier) => tier.from));
  for (const extra of [1, 3, 5]) if (counts.size < 3 && extra >= first.from) counts.add(extra);
  // Цена линейки карточки — первой ступени; прочие ступени — в той же доле от цены продавца.
  const share = (item.line?.linePrice ?? first.price) / first.price;
  const pieces = item.line?.pieces ?? wholesale.linePieces ?? wholesale.packQty;
  return [...counts].sort((a, b) => a - b).map((lines) => {
    const tier = tierFor(wholesale.tiers, lines) ?? first;
    const line = Math.round(tier.price * share);
    return {
      lines,
      pieces: lines * pieces,
      piece: pieces > 0 ? Math.round(line / pieces) : line,
      line,
      sum: line * lines,
      oldLine: tier.oldPrice === undefined ? undefined : Math.round(tier.oldPrice * share),
    };
  });
}

/**
 * Выбор, сколько линеек брать: у каждого варианта — штуки, цена штуки крупно, выгода против розницы,
 * цена линейки и сумма. Нажатие — до корзины в кнопку «В корзину», в корзине — сразу числом линеек.
 */
function LineTiers({ item, choices, chosen, onPick, maxLines }: {
  item: ShowcaseCardDto; choices: LineChoice[]; chosen: number; onPick: (lines: number) => void; maxLines?: number | null;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const best = choices.find((choice) => choice.lines === chosen) ?? choices[0];
  // Подсказка «ещё N линеек — дешевле» — только до ступени, которую хватит остатка взять.
  const next = choices.find((choice) => choice.lines > chosen && choice.piece < best.piece
    && (maxLines == null || choice.lines <= maxLines));
  const retail = item.wholesale?.retail && item.price > 0 ? item.price : undefined;
  const base = choices[0];
  // Цена одна при любом числе линеек — так и сказать, чтобы три одинаковые цены не читались ошибкой.
  const flat = choices.every((choice) => choice.piece === base.piece);
  const perLine = base.lines > 0 ? base.pieces / base.lines : 0;
  // Выгода к рознице — один раз над вариантами и с розничной ценой: метка в каждом варианте повторялась и не говорила, к чему −N%.
  // Только по вариантам, которые хватит остатка взять: «до 25%» за серую кнопку было бы пустым обещанием.
  // Вниз: выгода не больше настоящей — 29,6% это «на 29%», не «на 30%».
  const reachable = choices.filter((choice) => maxLines == null || choice.lines <= maxLines);
  const cheapest = Math.min(...reachable.map((choice) => choice.piece));
  // Разница × 100 / розница, а не (1 − доля) × 100: дробная арифметика давала 9,999… и «на 9%» вместо 10%.
  const percent = retail && reachable.length > 0 ? Math.floor(((retail - cheapest) * 100) / retail) : 0;
  const samePiece = reachable.every((choice) => choice.piece === reachable[0]?.piece);
  return (
    <section data-testid="line-tiers" aria-labelledby="line-tiers-title"
      className="flex flex-col gap-2.5 rounded-[var(--radius-tile)] bg-sunk p-3.5">
      <h3 id="line-tiers-title" className="text-body font-bold text-ink">{t('item.lineTiers.title')}</h3>
      <p className="-mt-1 text-caption text-ink-muted">
        {t('item.lineTiers.hint', { pieces: perLine })}
        {flat ? ` ${t('item.lineTiers.flat')}` : ''}
      </p>
      {retail && percent > 0 ? (
        <p data-testid="line-tiers-retail" className="-mt-1 text-caption font-semibold text-sale-ink">
          {t(samePiece ? 'item.lineTiers.retail' : 'item.lineTiers.retailUpTo', { price: money(retail, currency), percent })}
        </p>
      ) : null}
      <ul aria-label={t('item.lineTiers.title')} className="m-0 flex list-none flex-col gap-2 p-0">
        {choices.map((choice) => {
          const on = choice.lines === chosen;
          // Выгода против первого варианта — та же покупка по цене первой ступени.
          const saved = base.piece * choice.pieces - choice.sum;
          // Подпись слева — одной строкой: на телефоне «Цена за 1 / шт» рвалась (замечание portal-1a 2026-11-14).
          const row = 'flex items-baseline justify-between gap-3 [&>span:first-child]:whitespace-nowrap';
          return (
            <li key={choice.lines} data-testid="line-tier" aria-current={on ? 'true' : undefined}>
              <button type="button" onClick={() => onPick(choice.lines)} disabled={maxLines != null && choice.lines > maxLines}
                className={cn(
                  'flex w-full flex-col gap-2 rounded-[var(--radius-control)] p-3 text-left transition-colors duration-200 disabled:pointer-events-none disabled:opacity-45',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  on ? 'bg-accent-soft shadow-[0_0_0_2px_var(--color-accent)]' : 'bg-surface shadow-[0_0_0_1px_var(--color-hairline)] hover:bg-accent-soft/50',
                )}>
                <span className="flex items-center gap-3">
                  <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full',
                    on ? 'bg-accent text-on-accent' : 'shadow-[inset_0_0_0_1.5px_var(--color-hairline)]')}>
                    {on ? <Check aria-hidden="true" className="size-3.5" /> : null}
                  </span>
                  <span className={cn('flex-1 text-lead font-extrabold', on ? 'text-accent-ink' : 'text-ink')}>
                    {t('cart.lines.unitCount', { count: choice.lines })}
                  </span>
                </span>
                <span className="flex flex-col gap-1 border-t border-hairline pt-2 text-sm tabular-nums">
                  <span className={row}>
                    <span className="text-ink-muted">{t('item.lineTiers.piecesLabel')}</span>
                    <span className="font-semibold text-ink">
                      {t('item.lineTiers.pieces', { pieces: choice.pieces })}
                      {choice.lines > 1 ? <span className="font-normal text-ink-muted"> ({choice.lines} × {perLine})</span> : null}
                    </span>
                  </span>
                  <span className={row}>
                    <span className="text-ink-muted">{t('item.lineTiers.pieceLabel')}</span>
                    <span className="font-semibold text-ink">{money(choice.piece, currency)}</span>
                  </span>
                  <span className={row}>
                    {/* «Цена за 3 линейки» — за все линейки варианта (просьба владельца 2026-11-14). */}
                    <span className="text-ink-muted">{t('item.lineTiers.linesPrice', { count: choice.lines })}</span>
                    <span className="font-semibold text-wholesale-ink">
                      {choice.oldLine !== undefined && <s className="mr-1.5 font-normal text-ink-faint">{money(choice.oldLine * choice.lines, currency)}</s>}
                      {money(choice.sum, currency)}
                    </span>
                  </span>
                  {saved > 0 ? (
                    <span className={row}>
                      <span className="text-ink-muted">{t('item.lineTiers.savedLabel')}</span>
                      <span className="font-bold text-sale-ink">{money(saved, currency)}</span>
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {next ? (
        <p data-testid="line-tiers-next" className="flex items-center gap-2 text-caption font-semibold text-accent-ink">
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          {t('item.lineTiers.next', { count: next.lines - chosen, price: money(next.piece, currency) })}
        </p>
      ) : null}
    </section>
  );
}

function PiecePurchase({ item, mode }: { item: ShowcaseCardDto; mode?: SaleMode }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const cart = cartOf(useCart().data);
  const { add, isPending } = useAddToCart();
  // «В розницу» — опт к этой покупке не относится: ни условий, ни разбиения.
  const wholesale = mode === 'RETAIL' ? undefined : item.wholesale;
  const only = packsOnly(item);
  // Поле считает в единицах витрины: у «только опт» — упаковки, иначе штуки.
  // Корзина хранит штуки: уложенное переводится обратно делением на вложение.
  const perPack = only ? wholesale!.packQty : 1;
  // Только строка этой заявки: взятое в розницу не показывается лежащим в опте.
  const inCart = lineOf(cart, item.id, mode)?.quantity;
  const ordered = inCart === undefined ? undefined : inCart / perPack;
  // В «Оптом» у товара «оптом и в розницу» сразу одна упаковка первой ступени: иначе в счётчике стоял минимум
  // розницы, и «В корзину» клало его по розничной цене (просьба владельца 2026-11-15).
  const packStart = mode === 'WHOLESALE' && wholesale && !only && wholesale.packQty > 1 && wholesale.tiers[0]
    // Без подгонки под кратность розницы: «по 3 шт.» из 10 пар упаковки сделало бы 12 — упаковка и 2 пары в розницу.
    ? wholesale.tiers[0].from * wholesale.packQty : undefined;
  // В «Оптом» счётчик шагает упаковками: «по 3 шт.» розницы делал из 5 упаковок 51 шт., а «−» — 4 упаковки и 8 шт.
  const counterTerms = packStart !== undefined && wholesale
    ? { ...item.terms, minQuantity: wholesale.packQty, quantityStep: wholesale.packQty } : item.terms;
  const start = packStart ?? firstQuantity(item.terms);
  const [wanted, setWanted] = useState(start);
  // Переключили «В розницу» ↔ «Оптом» до корзины — счётчик встаёт на начало выбранной заявки.
  // Зависимость — число, а не `item.terms`: новый объект при каждом обновлении карточки сбрасывал счётчик.
  useEffect(() => {
    setWanted(start);
  }, [start]);
  const amount = ordered ?? wanted;
  const setLine = useSetCartLine();
  // Нажатая ступень: до корзины — в счётчик, уже в корзине — сразу строкой корзины.
  const pick = (tierPieces: number) => {
    const next = fitQuantity(tierPieces / perPack, counterTerms);
    if (ordered === undefined) setWanted(next);
    else setLine.mutate({ itemId: item.id, data: { quantity: next * perPack, mode } });
  };
  const pieces = toPieces(item, amount);
  const split = wholesale ? splitOf(wholesale, pieces) : undefined;
  // Сумма — тем же разбиением, что посчитает корзина: упаковки по ступени, остаток в розницу.
  const sum = split?.tier
    ? split.packs * split.tier.price + (only ? 0 : split.rest * item.price)
    : item.price * amount;
  // В упаковке одна единица (линейка, пресс продаются сами собой) — «1 линейка = 1 линейка × цена» ничего не объясняет.
  const breakdown = split && split.packs > 0 && wholesale && wholesale.packQty !== 1 ? (
    <p data-testid="wholesale-split" className="text-caption font-semibold text-ink-muted">
      {t('item.wholesale.split', {
        pieces: quantityWithUnit(pieces, wholesale.pieceUnit),
        packs: quantityWithUnit(split.packs, wholesale.unit),
        price: money(split.tier!.price, currency),
      })}
      {split.rest > 0
        ? ` + ${quantityWithUnit(split.rest, wholesale.pieceUnit)} × ${money(item.price, currency)}`
        : ''}
    </p>
  ) : null;

  if (ordered !== undefined) {
    return (
      <div className="flex flex-col gap-3">
        {wholesale && <WholesaleTerms item={item} wholesale={wholesale} pieces={pieces} packs={split?.packs ?? 0} mode={mode} onPick={pick} />}
        {breakdown}
        <p role="status" className="flex items-center gap-2.5 rounded-[var(--radius-control)] bg-ok-soft px-3.5 py-3 text-body font-bold text-ok-ink">
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          {t('item.added', { amount: quantityWithUnit(ordered, item.unit) })}
        </p>
        <div data-purchase-bar="" className={PHONE_BAR}>
          <div className="flex items-center justify-center gap-3 lg:flex-[1_0_auto] lg:justify-start">
            <QuantityField itemId={item.id} unit={item.unit} terms={counterTerms} perPack={perPack} mode={mode}
              className="h-13 w-[9.5rem] flex-none lg:w-[12.5rem]" />
            <Sum amount={sum} />
          </div>
          <Link
            to="/checkout"
            aria-label={t('item.toCart')}
            className={cn(
              'flex h-13 w-full min-w-0 items-center justify-center gap-2.5 rounded-[1rem] bg-accent px-3 lg:h-14 lg:w-auto lg:flex-[1_0_auto] lg:bg-ink lg:px-7',
              // Надпись — парная заливке: на телефоне `on-accent`, на мониторе `on-ink`. Белая
              // ночью не читалась на светлом акценте, а `night` сливался с тёмной карточкой.
              'text-body font-bold text-on-accent lg:text-on-ink transition-opacity duration-200 hover:opacity-90 lg:text-lead',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            )}
          >
            <span className="truncate lg:hidden">{t('item.inCartSum', { sum: money(sum, currency) })}</span>
            <span className="max-lg:hidden">{t('item.toCart')}</span>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0 max-lg:hidden" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {wholesale && <WholesaleTerms item={item} wholesale={wholesale} pieces={pieces} packs={split?.packs ?? 0} mode={mode} onPick={pick} />}
      {breakdown}
      <div data-purchase-bar="" className={PHONE_BAR}>
        <div className="flex items-center justify-center gap-3 lg:flex-[1_0_auto] lg:justify-start">
          <LocalStepper value={wanted} unit={item.unit} terms={counterTerms} onChange={setWanted} />
          <Sum amount={sum} />
        </div>
        <Button
          /*
            Цвет магазина и самый крупный размер: на карточке это единственное
            главное действие и то, ради чего её открыли.
          */
          variant="accent"
          size="xl"
          // На мониторе — в строку с количеством и суммой, цветом скидки, как корзина в шапке (ПК-К3).
          className="h-13 w-full min-w-0 gap-2 rounded-[1rem] px-3 text-body lg:h-14 lg:w-auto lg:flex-[1_0_auto] lg:rounded-[calc(var(--radius-tile)*1.125)] lg:bg-sale lg:px-7 lg:text-on-sale lg:hover:bg-sale-ink"
          disabled={isPending || wanted <= 0}
          // Имя кнопки — одно на любой ширине; сумма в подписи телефона — для глаз.
          aria-label={t('item.add')}
          onClick={async (event) => {
            // Летит текущий кадр галереи: заявка живёт наверху экрана или справа,
            // и молча нажатая кнопка заставляет класть позицию второй раз.
            const shot = document.querySelector('[data-testid="gallery-photo"]') ?? event.currentTarget;
            const added = await add(item, wanted, mode);
            if (added) flyToCart(shot);
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[22px] shrink-0 max-lg:hidden" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L22 8H6.2" /></svg>
          {/* На телефоне сумма — в самой кнопке, отдельной строки «Сумма» нет. */}
          <span className="truncate lg:hidden">{t('item.addSum', { sum: money(sum, currency) })}</span>
          <span className="max-lg:hidden">{t('item.add')}</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * Оптовые цены — видны всегда, до набора количества: клиент должен понимать, что сделать ради опта.
 * Ступень — кнопка: нажал — количество ступени встало в счётчик (или в корзину, если товар уже там).
 * Крупно цена за штуку/кг — её сравнивают с розницей, рядом выгода в процентах; цена упаковки мельче.
 * Ниже — сколько добрать до следующей ступени (просьба владельца 2026-11-06).
 */
function WholesaleTerms({ item, wholesale, pieces, packs, mode, onPick }: {
  item: ShowcaseCardDto; wholesale: ShowcaseWholesaleDto; pieces: number; packs: number; mode?: SaleMode;
  onPick: (pieces: number) => void;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const current = tierFor(wholesale.tiers, packs);
  // Опт штуками (вложение 1): «шт = 1 шт.» и цена упаковки рядом с той же ценой за штуку — шум.
  const packed = wholesale.packQty > 1;
  const only = packsOnly(item);
  const whole = Math.floor(pieces / wholesale.packQty);
  const next = wholesale.tiers.find((tier) => tier.from > whole);
  const unitPrice = (price: number) => Math.round(price / wholesale.packQty);
  const saving = (price: number) => wholesale.retail && item.price > 0
    ? Math.round((1 - unitPrice(price) / item.price) * 100) : 0;
  return (
    <section data-testid="wholesale-terms" aria-labelledby="wholesale-terms-title"
      className="flex flex-col gap-2.5 rounded-[var(--radius-tile)] bg-sunk p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="wholesale-terms-title" className="text-body font-bold text-ink">{t('item.wholesale.title')}</h3>
        {packed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-caption font-semibold text-ink-muted shadow-[0_0_0_1px_var(--color-hairline)]">
            <Package aria-hidden="true" className="size-3.5 shrink-0" />
            {t('item.wholesale.packOf', { unit: `1 ${wholesale.unit}`, amount: quantityWithUnit(wholesale.packQty, wholesale.pieceUnit) })}
          </span>
        ) : null}
      </div>
      <p className="-mt-1 text-caption text-ink-muted">{t('item.wholesale.pickHint')}</p>
      <ul data-testid="wholesale-tiers" aria-label={t('item.wholesale.tiers')} className="m-0 flex list-none flex-col gap-1.5 p-0">
        {wholesale.tiers.map((tier) => {
          const on = tier === current;
          const percent = saving(tier.price);
          return (
            <li key={tier.from} data-testid="wholesale-tier" aria-current={on ? 'true' : undefined}>
              <button
                type="button"
                onClick={() => onPick(tier.from * wholesale.packQty)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-left transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  on ? 'bg-accent-soft shadow-[0_0_0_2px_var(--color-accent)]' : 'bg-surface shadow-[0_0_0_1px_var(--color-hairline)] hover:bg-accent-soft/50',
                )}
              >
                <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full',
                  on ? 'bg-accent text-on-accent' : 'shadow-[inset_0_0_0_1.5px_var(--color-hairline)]')}>
                  {on ? <Check aria-hidden="true" className="size-3.5" /> : null}
                </span>
                {/* Порог — одной строкой, а цены справа переносятся: на 360 «от 1 / упаковки» наезжало на зачёркнутую цену. */}
                <span className="flex shrink-0 flex-col">
                  <span className={cn('whitespace-nowrap text-body font-bold', on ? 'text-accent-ink' : 'text-ink')}>
                    {fromQuantity(tier.from, wholesale.unit) ?? t('item.wholesale.tierFrom', { amount: quantityWithUnit(tier.from, wholesale.unit) })}
                  </span>
                  {packed ? (
                    <span className="text-caption text-ink-muted">{quantityWithUnit(tier.from * wholesale.packQty, wholesale.pieceUnit)}</span>
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col items-end text-right tabular-nums">
                  <span className="flex flex-wrap items-baseline justify-end gap-x-1.5">
                    {percent > 0 ? (
                      <span className="rounded-full bg-sale-soft px-1.5 text-caption font-bold text-sale-ink">−{percent}%</span>
                    ) : null}
                    <span className={cn('text-lead font-extrabold', on ? 'text-accent-ink' : 'text-ink')}>
                      {money(unitPrice(tier.price), currency)}
                    </span>
                    <span className="whitespace-nowrap text-caption text-ink-muted">{t('catalog.priceNote.perUnit', { unit: unitPer(wholesale.pieceUnit) })}</span>
                  </span>
                  {packed ? (
                    <span className="flex flex-wrap justify-end gap-x-1.5 text-caption text-ink-muted">
                      {tier.oldPrice !== undefined && <s className="text-ink-faint">{money(tier.oldPrice, currency)}</s>}
                      <span className="whitespace-nowrap">{t('item.wholesale.packPrice', { price: money(tier.price, currency), unit: unitPer(wholesale.unit) })}</span>
                    </span>
                  ) : tier.oldPrice !== undefined ? (
                    <s className="text-caption text-ink-faint">{money(tier.oldPrice, currency)}</s>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {next ? (
        <p data-testid="wholesale-next" className="flex items-center gap-2 text-caption font-semibold text-accent-ink">
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          {t('item.wholesale.next', {
            amount: only
              ? quantityWithUnit(next.from - whole, wholesale.unit)
              : quantityWithUnit(next.from * wholesale.packQty - pieces, wholesale.pieceUnit),
            price: money(unitPrice(next.price), currency),
            unit: unitPer(wholesale.pieceUnit),
          })}
        </p>
      ) : null}
      <p className="text-caption text-ink-muted">
        {wholesale.retail
          ? t('item.wholesale.belowMin', {
            price: money(item.price, currency),
            unit: unitPer(wholesale.pieceUnit),
          })
          : t('item.wholesale.onlyPacks', { amount: quantityWithUnit(wholesale.tiers[0].from, wholesale.unit) })}
      </p>
      {item.discountPercent && !wholesale.tiers[0]?.oldPrice ? (
        <p className="text-caption font-semibold text-sale-ink">{t('item.wholesale.noSale')}</p>
      ) : null}
      {mode === 'WHOLESALE' ? <WholesaleMinimum item={item} wholesale={wholesale} /> : null}
    </section>
  );
}

/** «Оптом в корзину: 10 шт.» — сервер раскладывает минимум опта поровну по размерам этого цвета. */
function WholesaleMinimum({ item, wholesale }: { item: ShowcaseCardDto; wholesale: ShowcaseWholesaleDto }) {
  const { t } = useTranslation();
  const minimum = useWholesaleMinimum();
  const current = (item.variants ?? []).find((variant) => variant.itemId === item.id);
  const sizes = current ? sizeRowsOf(item.variants ?? [], current).length : 0;
  // Один размер — минимум подставляется нажатием на ступень, вторая кнопка «в корзину» только путала.
  if (sizes < 2) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="outline" disabled={minimum.isPending}
        onClick={() => minimum.mutate({ itemId: item.id }, {
          onSuccess: (response) => { if (response.status === 200) announceAdded(item.name); },
        })}>
        {t('item.wholesale.minimum', { amount: quantityWithUnit(wholesale.tiers[0].from * wholesale.packQty, wholesale.pieceUnit) })}
      </Button>
      <p className="text-caption text-ink-muted">{t('item.wholesale.minimumSizes')}</p>
    </div>
  );
}

/** «Сумма» справа от количества — крупно, табличными цифрами. */
function Sum({ amount }: { amount: number }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  return (
    <div className="ml-auto flex flex-col items-end max-lg:hidden">
      <span className="text-caption text-ink-subtle">{t('item.sum')}</span>
      <span data-testid="item-sum" className="text-2xl font-extrabold tabular-nums tracking-[-0.01em] text-ink">{money(amount, currency)}</span>
    </div>
  );
}

/**
 * Количество до корзины: «+» и «−» по кратности продавца, ниже минимума
 * не опускается — убирать из корзины здесь ещё нечего.
 */
function LocalStepper({
  value,
  unit,
  terms,
  onChange,
}: {
  value: number;
  unit: string;
  terms?: ItemSaleTerms;
  onChange: (next: number) => void;
}) {
  const { t } = useTranslation();
  const least = firstQuantity(terms);
  const button = cn(
    'flex size-[46px] shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*6/7)] bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]',
    'transition-all duration-200 active:scale-95 hover:bg-sunk disabled:pointer-events-none disabled:opacity-40',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  );
  return (
    <div className="flex h-14 w-[12.5rem] flex-none items-center justify-between gap-1 rounded-[var(--radius-tile)] bg-sunk p-1 shadow-[0_0_0_1px_var(--color-hairline)]">
      <button
        type="button"
        aria-label={t('cart.less')}
        className={button}
        disabled={value <= least}
        onClick={() => onChange(Math.max(least, lessQuantity(value, terms)))}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
          <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <span aria-live="polite" className="text-lg font-bold tabular-nums text-ink">
        {quantityWithUnit(value, unit)}
      </span>
      <button
        type="button"
        aria-label={t('cart.more')}
        className={button}
        onClick={() => onChange(fitQuantity(value + stepOf(terms), terms))}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
          <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Под кнопкой — справкой, без акцента (просьба владельца 2026-11-14): что платить заранее не нужно
 * и как можно получить — доставкой, самовывозом или и так и так. Адреса, цены и часы — при
 * оформлении. Скидки стоят своей панелью ниже (`DiscountsPanel`).
 */
function DealFacts() {
  const { t } = useTranslation();
  const options = useGetPortalDeliveryOptions();
  const delivery = options.data?.status === 200 ? options.data.data : undefined;
  const methods = delivery?.methods ?? [];
  const delivers = delivery?.mode !== 'PICKUP_ONLY' && methods.some((method) => !method.pickup);
  const pickup = delivery?.mode === 'PICKUP_ONLY' || methods.some((method) => method.pickup)
    || (delivery?.pickupPoints ?? []).length > 0;
  const way = delivers && pickup ? 'both' : delivers ? 'delivery' : pickup ? 'pickup' : null;
  const line = 'flex items-center gap-2 text-sm text-ink-muted';
  return (
    <div className="flex flex-col gap-1.5">
      <p className={line}>
        <ShieldCheck aria-hidden="true" className="size-[18px] shrink-0 text-accent-ink" />
        <span><b className="font-semibold text-ink">{t('item.factPayLabel')}</b> {t('item.factPay')}</span>
      </p>
      {way ? (
        // Ссылкой на «Доставку и самовывоз» (просьба владельца 2026-11-14) — там адреса, цены и часы.
        <Link to="/delivery" data-testid="deal-way"
          className={cn(line, 'self-start rounded-[var(--radius-control)] no-underline hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent')}>
          {way === 'pickup'
            ? <Store aria-hidden="true" className="size-[18px] shrink-0 text-accent-ink" />
            : <Truck aria-hidden="true" className="size-[18px] shrink-0 text-accent-ink" />}
          {t(`item.deal.${way}`)}
          <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Характеристики и описание — панелью под снимками. Если среди свойств есть
 * состав в процентах («Вискоза 65%, полиэстер 30%»), он показан ещё и полосками
 * — «Из чего сделано»: доли читаются быстрее, чем через запятую.
 */
function SpecPanel({
  item,
  properties,
  wide,
}: {
  item: ShowcaseCardDto;
  properties: { key: string; name: string; value: string; hex?: string }[];
  /** Во всю ширину страницы — свойства в две колонки. */
  wide: boolean;
}) {
  const { t } = useTranslation();
  const { parts: composition, key: compositionKey } = compositionOf(properties);
  // Разобранный состав — только полосками «Из чего сделано»: строкой он повторял бы их (просьба владельца 2026-11-14).
  const rows = composition.length >= 2 ? properties.filter((property) => property.key !== compositionKey) : properties;
  const panel = 'flex flex-col rounded-[calc(var(--radius-card)*13/11)] bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-hairline)] lg:px-7 lg:py-6';
  return (
    <>
      {item.description || rows.length > 0 ? (
      <div className={cn(panel, 'gap-1.5')}>
        <h2 id="attributes-heading" className="text-xl font-extrabold text-ink lg:text-2xl">{t('catalog.attributes')}</h2>
        {item.description && (
          <p className="whitespace-pre-line py-2 text-body leading-relaxed text-ink-muted">{item.description}</p>
        )}
        {rows.length > 0 && (
          /*
            Список описаний, а не таблица: свойств у позиции от двух
            до двадцати, и таблица из двух строк выглядит поломкой вёрстки.
          */
          // На мониторе панель во всю ширину — свойства в две колонки; у нечётного
          // последнего в левой колонке черта снизу лишняя, как у последнего в правой.
          <dl aria-labelledby="attributes-heading"
            className={cn('flex flex-col', wide && 'lg:grid lg:grid-cols-2 lg:gap-x-12 lg:[&>div:nth-last-child(2):nth-child(odd)]:border-b-0')}>
            {rows.map((property) => (
              <div
                key={property.key}
                data-testid="item-property"
                className="flex items-baseline justify-between gap-4 border-b border-hairline py-3.5 text-body last:border-b-0"
              >
                <dt className="text-ink-muted">{property.name}</dt>
                <dd className="flex items-center gap-2 text-right font-bold text-ink">
                  {/* Цвет — кружком цвета рядом со словом (просьба владельца 2026-11-14). */}
                  {COLOUR.test(property.name) && (property.hex ?? colourOf(property.value)) ? (
                    <span aria-hidden="true" data-testid="colour-dot" style={{ background: property.hex ?? colourOf(property.value) }}
                      className="size-5 shrink-0 rounded-full shadow-[0_0_0_1px_var(--color-hairline)]" />
                  ) : null}
                  {property.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      ) : null}
      {composition.length >= 2 && (
        <div className={cn(panel, 'gap-[18px]')}>
          <h3 className="text-lg font-extrabold text-ink">{t('item.composition')}</h3>
          {/*
            Доли одной полосой, как в макете: полоса читается как целое,
            из которого складываются части, — отдельные полоски этого не говорят.
          */}
          <div aria-hidden="true" className="flex h-[18px] gap-[3px] overflow-hidden rounded-[9px]">
            {composition.map((part, index) => (
              <span key={part.name} className={SHARE_COLORS[index % SHARE_COLORS.length]} style={{ width: `${part.percent}%` }} />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {composition.map((part, index) => (
              <li key={part.name} className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <span aria-hidden="true" className={cn('size-2.5 rounded-full', SHARE_COLORS[index % SHARE_COLORS.length])} />
                  {part.name}
                </span>
                <b className="text-display font-extrabold tabular-nums text-ink">{part.percent}%</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * Где на мониторе стоят характеристики: под снимками (`beside`), если колонка
 * решения выше снимков хотя бы на 400px, — иначе во всю ширину. Панель в одну
 * колонку — обычно 450–600px: при меньшем перепаде она перерастала бы решение,
 * и пустота справа выходила бы больше, чем под снимками.
 * ponytail: порог на глаз; точнее — мерить саму панель в одну колонку.
 */
/** Последняя раскладка карточки: другой цвет той же модели встаёт сразу так же, без перескока характеристик. */
let lastBeside = false;

function useSpecBeside() {
  const gallery = useRef<HTMLDivElement>(null);
  const decision = useRef<HTMLDivElement>(null);
  const [beside, setBeside] = useState(lastBeside);
  useEffect(() => {
    const left = gallery.current;
    const right = decision.current;
    if (!left || !right || typeof ResizeObserver === 'undefined') return;
    // Только на мониторе (`lg`): на телефоне части идут подряд, и колонка там не нужна.
    const wide = window.matchMedia('(min-width: 64rem)');
    const measure = () => { lastBeside = wide.matches && right.offsetHeight - left.offsetHeight >= 400; setBeside(lastBeside); };
    const observer = new ResizeObserver(measure);
    observer.observe(left);
    observer.observe(right);
    return () => observer.disconnect();
  }, []);
  return { gallery, decision, beside };
}

/** Цвета долей состава: различимы и по светлоте, не только по оттенку. */
const SHARE_COLORS = ['bg-accent', 'bg-star-soft', 'bg-[#E7A0AE]', 'bg-[#5B7FA6]', 'bg-ink-faint'];

/**
 * Доли состава из свойства «Состав»: «Вискоза 65%, полиэстер 30%, эластан 5%».
 * Только если сумма — сто процентов: иначе это не состав, а что-то похожее,
 * и полоски соврали бы.
 */
function compositionOf(properties: { key: string; name: string; value: string }[]) {
  const source = properties.find((property) => /^(состав|құрамы|composition)/i.test(property.name));
  if (!source) return { parts: [], key: undefined };
  const parts = [...source.value.matchAll(/([\p{L}][\p{L}\s-]*?)\s*(\d{1,3})\s*%/gu)]
    .map((match) => ({ name: match[1].trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase()), percent: Number(match[2]) }));
  const sum = parts.reduce((total, part) => total + part.percent, 0);
  return { parts: sum === 100 ? parts : [], key: source.key };
}

/**
 * «Участвует в акции» — ссылкой на «Акции и скидки», с отсчётом до конца.
 * Только когда у товара есть скидка распродажи и распродажа идёт.
 */
function SaleParticipation({ mode }: { mode?: SaleMode }) {
  const { t } = useTranslation();
  // Распродажи опта и розницы свои (2026-11-13): плашка — той, чья скидка в цене карточки (QA 2026-11-15).
  const promotions = usePromotions(true, mode);
  const sale = promotions.data?.status === 200 ? promotions.data.data.sale : undefined;
  const left = useSaleCountdown(sale?.endsAt);
  if (!sale) return null;
  const until = sale.endsOn ? dayMonth(sale.endsOn) : null;
  const box = 'flex min-w-10 flex-col items-center justify-center rounded-[calc(var(--radius-control)*5/7)] bg-black/25 px-1.5 py-1.5 leading-none';
  return (
    <Link
      to="/promotions"
      data-testid="sale-participation"
      className="flex flex-wrap items-center gap-3.5 rounded-[calc(var(--radius-tile)*1.125)] bg-sale px-4 py-3.5 text-on-sale transition-opacity hover:opacity-95"
    >
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*6/7)] bg-black/25">
        <Tag className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-body">{t('item.inSale', { title: sale.title })}</b>
        <span className="text-caption text-white/80">
          {until ? t('item.inSaleUntil', { date: until }) : t('promotions.sale.noCode')}
        </span>
      </span>
      {left && sale.countdown && (
        <span className="flex gap-1 tabular-nums" aria-label={t('promotions.sale.leftLabel', left)}>
          <span className={box}><b className="text-lead">{left.days}</b><span className="mt-1 text-2xs text-white/80">{t('item.dd')}</span></span>
          <span className={box}><b className="text-lead">{String(left.hours).padStart(2, '0')}</b><span className="mt-1 text-2xs text-white/80">{t('item.hh')}</span></span>
          <span className={box}><b className="text-lead">{String(left.minutes).padStart(2, '0')}</b><span className="mt-1 text-2xs text-white/80">{t('item.mm')}</span></span>
        </span>
      )}
    </Link>
  );
}

function useSaleCountdown(endsAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  const minutes = Math.floor(Math.max(0, new Date(endsAt).getTime() - now) / 60_000);
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

/**
 * «Скидки на этот товар»: какие скидки магазина к нему применимы и что
 * будет с корзиной. Распродажа — уже в цене; за объём — от суммы заявки;
 * на первую заявку — если покупателю она ещё положена. Числа — из акций
 * и корзины, экран их не придумывает.
 */
function DiscountsPanel({ item }: { item: ShowcaseCardDto }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const promotions = usePromotions();
  const data = promotions.data?.status === 200 ? promotions.data.data : undefined;
  const cart = cartOf(useCart().data);
  if (!data) return null;
  const tier = data.volumeTiers[0];
  const first = data.firstOrder?.status === 'ELIGIBLE' ? data.firstOrder : undefined;
  // Строка распродажи — только при акции магазина: скидка без акции (своя цена товара)
  // давала пустой блок с одним заголовком.
  if (!(item.discountPercent && data.sale) && !tier && !first) return null;
  const goods = cart?.goodsTotal ?? 0;
  // Ближайший порог считается здесь по самим порогам, а не по `cart.nextTier`:
  // тот приходит, только когда продавец включил подсказку в корзине и до
  // порога близко, — его отсутствие не значит, что порог набран.
  const upcoming = data.volumeTiers.find((entry) => entry.from > goods);
  const next = upcoming ? { missing: upcoming.from - goods, percent: upcoming.percent } : undefined;
  const volumeOn = cart?.discount?.kind === 'VOLUME';

  // Сколько набрано до ближайшего порога — полосой, как в макете.
  const progress = next ? Math.round((goods / (goods + next.missing)) * 100) : 100;
  // Набранный порог — самый высокий из пройденных: о нём и говорит «Сумма больше…».
  const passed = [...data.volumeTiers].reverse().find((entry) => entry.from <= goods);
  // Полоса «ещё N» — как решил магазин и как на странице акций: только
  // с подсказкой (`volumeHintPercent`) и когда до порога уже близко или
  // скидка взята. Издалека строка просто называет условие.
  const hintShare = data.volumeHintPercent;
  const near = upcoming !== undefined && hintShare != null
    && (passed !== undefined || (upcoming.from - goods) * 100 <= upcoming.from * hintShare);
  const showBar = upcoming ? near : passed !== undefined;
  // Порог в строке — тот, к которому идёт полоса; все взяты — последний взятый.
  const shown = upcoming ?? passed ?? tier;
  const volumeSub = passed && upcoming
    ? t('item.discounts.partial', { have: passed.percent, missing: money(upcoming.from - goods, currency), percent: upcoming.percent })
    : t('item.discounts.from', { amount: money(shown?.from ?? 0, currency) });
  const volumeValue = passed && upcoming ? passed.percent : shown?.percent;

  const row = (key: string, on: boolean, title: string, sub: string, value?: string, muted = false) => (
    <li key={key} className={cn('flex items-center gap-3 text-sm', muted && 'opacity-70')}>
      <span
        aria-hidden="true"
        className={cn('flex size-[26px] shrink-0 items-center justify-center rounded-full text-caption font-black',
          on ? 'bg-accent text-on-accent' : 'bg-sunk text-ink-muted')}
      >
        {on ? '✓' : muted ? '—' : '%'}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-ink">{title}</b>
        <span className="text-caption text-ink-subtle">{sub}</span>
      </span>
      {value && <b className={on ? 'text-sale-ink' : 'text-ink-muted'}>{value}</b>}
    </li>
  );

  return (
    <section aria-labelledby="h-item-discounts" className="flex flex-col gap-3 rounded-[calc(var(--radius-tile)*1.25)] bg-surface px-[18px] py-4 shadow-[0_0_0_1px_var(--color-hairline)]">
      <h2 id="h-item-discounts" className="text-caption font-bold uppercase tracking-[0.06em] text-ink-subtle">{t('item.discounts.title')}</h2>
      <ul className="flex flex-col gap-3">
        {/* Строка «не участвует в акциях» ничего не давала клиенту — её нет (макеты «Кабинет клиента 2.0»). */}
        {item.discountPercent && data.sale
          ? row('sale', true, data.sale.title, t('item.discounts.inPrice'), `−${item.discountPercent}%`)
          : null}
        {tier && row('volume', volumeOn, t('promotions.volume.title'), volumeSub, `−${volumeValue}%`)}
        {first && row('first', cart?.discount?.kind === 'FIRST_ORDER', t('promotions.v2.first.title'),
          t('item.discounts.newBuyers'), `−${first.percent}%`)}
      </ul>
      {tier && showBar && (
        <>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-sunk">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-caption font-semibold text-accent-ink">
            {next
              ? t('item.discounts.left', { amount: money(next.missing, currency) })
              : t('item.discounts.reached', { threshold: money(passed?.from ?? tier.from, currency) })}
          </p>
        </>
      )}
      {[item.discountPercent && data.sale, tier, first].filter(Boolean).length > 1 && (
        <p className="text-xs text-ink-faint">{t('promotions.v2.noStack')}</p>
      )}
    </section>
  );
}

/**
 * Чем заменить позицию, которой нет: похожие по названию и рубрике, которые
 * сейчас в наличии. Стоит выше отзывов — человеку, упёршемуся в «нет в наличии»,
 * сначала нужен выход, а не чужие оценки того, что купить нельзя.
 */
function Substitutes({ itemId }: { itemId: string }) {
  const { t } = useTranslation();
  const substitutes = useGetPortalCatalogSubstitutes(itemId);
  const items = substitutes.data?.status === 200 ? substitutes.data.data : [];
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="substitutes-heading" data-testid="substitutes" className="flex flex-col gap-4 lg:gap-[18px]">
      <h2 id="substitutes-heading" className="text-xl font-extrabold tracking-[-0.02em] text-ink lg:text-display lg:font-black">
        {t('item.substitutes')}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {items.map((entry) => <SimilarCard key={entry.id} entry={entry} />)}
      </div>
    </section>
  );
}

/**
 * Похожие товары — из той же рубрики, без самой позиции.
 *
 * Рубрика и есть «похожесть», которую знает система: придумывать связи
 * между товарами, которых продавец не проводил, она не вправе.
 */
function Similar({ itemId, categoryId, categoryName }: { itemId: string; categoryId: string; categoryName?: string }) {
  const { t } = useTranslation();
  const similar = useGetPortalCatalog({ categoryId, page: 0, size: 5, sort: 'POPULAR' });
  const items = (similar.data?.status === 200 ? (similar.data.data.items ?? []) : [])
    .filter((entry) => entry.id !== itemId)
    .slice(0, 4);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="similar-heading" className="flex flex-col gap-4 lg:gap-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="similar-heading" className="text-xl font-extrabold tracking-[-0.02em] text-ink lg:text-display lg:font-black">{t('item.similar')}</h2>
        <Link
          to={categoryName ? `/catalog?category=${encodeURIComponent(categoryId)}` : '/catalog'}
          className="text-sm font-bold text-accent-ink underline-offset-[3px] hover:underline lg:text-body"
        >
          {categoryName ? t('item.allInCategory', { name: categoryName }) : t('item.allCatalog')} →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {items.map((entry) => <SimilarCard key={entry.id} entry={entry} />)}
      </div>
    </section>
  );
}

/**
 * Карточка похожего товара: снимок с метками, название, оценка, цена
 * и «+ В корзину» — положить, не открывая его карточку.
 */
function SimilarCard({ entry: item }: { entry: ShowcaseItemDto }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const cart = cartOf(useCart().data);
  const { add, isPending } = useAddToCart();
  const [orderMode] = useOrderMode();
  // Цена и метки выбранной заявки; в корзину кладётся сама позиция.
  const entry = inMode(item, orderMode);
  const inCart = takenIn(cart, orderMode).has(entry.id);

  return (
    <div
      data-testid="similar-card"
      className={cn(
        'flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface',
        'shadow-[0_0_0_1px_var(--color-hairline)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_0_0_1px_var(--color-line)]',
      )}
    >
      <Link
        to={`/catalog/${entry.id}`}
        className="flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <div className="relative">
          <ItemThumb itemId={entry.id} src={entry.thumbnailUrl} className="h-40 w-full lg:h-[250px]" />
          <ItemBadges item={entry} words className="absolute left-2.5 top-2.5" />
        </div>
        <span className="flex flex-col gap-2 px-4 pt-4">
          <span className="line-clamp-2 min-h-10 text-body font-semibold leading-snug text-ink">{entry.name}</span>
          <RatingBadge rating={entry.rating} reviewCount={entry.reviewCount} />
          <span className="flex flex-wrap items-baseline gap-2">
            <span className={cn('text-lg font-extrabold tabular-nums lg:text-title', 'text-ok-ink')}>
              {money(entry.price, currency)}
            </span>
            {entry.oldPrice != null && <s className="text-caption tabular-nums text-ink-faint">{money(entry.oldPrice, currency)}</s>}
            <span className="text-caption font-semibold text-ink-muted">
              {t('catalog.priceNote.perUnit', { unit: unitPer(entry.unit) })}
            </span>
          </span>
        </span>
      </Link>
      <div className="px-4 pb-4 pt-2">
        {inCart ? (
          <Link
            to="/checkout"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-ok-soft text-body font-bold text-ok-ink"
          >
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {t('item.similarInCart')}
          </Link>
        ) : (
          <button
            type="button"
            disabled={isPending}
            aria-label={t('item.similarAddAria', { name: entry.name })}
            onClick={() => void add(item)}
            className={cn(
              'flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent-soft text-body font-bold text-accent-ink',
              'transition-colors duration-200 hover:bg-accent hover:text-on-accent disabled:opacity-60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            {t('item.similarAdd')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Возврат кружком поверх снимка — в раздел, из которого карточку открыли (каталог, избранное,
 * корзина, «Главная»), с тем же отбором и прокруткой; похожие товары по пути пропускаются.
 * Открытая по присланному адресу карточка истории не имеет — тогда в каталог.
 */
function BackCircle() {
  const { t } = useTranslation();

  const back = useBackToSection();

  return (
    <button
      type="button"
      onClick={back}
      aria-label={t('common.back')}
      className={cn(
        'inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0',
        'bg-surface/85 text-ink backdrop-blur',
        'transition-all duration-300 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        // На мониторе путь обратно стоит строкой над карточкой.
        'md:hidden',
      )}
    >
      <ArrowLeft className="size-[18px]" aria-hidden="true" />
    </button>
  );
}
