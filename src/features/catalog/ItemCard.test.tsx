import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { HeaderOrderMode } from './OrderModeSwitch';
import { ItemCardPage } from './ItemCardPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch, type StubbedResponse } from '../../test/http';

const CARD = {
  id: 'item-1',
  name: 'Цемент М400',
  description: 'Портландцемент общестроительного назначения.',
  unit: 'мешок',
  price: 2500,
  vatRate: 12,
  priceAsOf: '2026-09-04T10:00:00Z',
  stock: 'IN_STOCK',
  media: [
    { id: 'm1', kind: 'PHOTO', source: 'LINK', url: 'https://cdn.example/cement.jpg', title: 'Мешок 50 кг', sortOrder: 10 },
    { id: 'm2', kind: 'VIDEO', source: 'LINK', url: 'https://cdn.example/cement.mp4', sortOrder: 20 },
  ],
  attributes: [
    { name: 'Марка', value: 'М400' },
    { name: 'Вес', value: '50 кг' },
  ],
  favorite: false,
  rating: 4.5,
  reviewCount: 2,
  canReview: true,
};

const emptyCart = { lines: [], total: 0, skipped: [] };

/** Корзина, в которой эта позиция уже набрана: с неё считается сумма на кнопке. */
function cartWith(quantity: number) {
  return {
    lines: [{
      itemId: 'item-1', name: 'Цемент М400', quantity, unit: 'мешок',
      priceAtAdding: 2500, price: 2500, priceChanged: false, total: 2500 * quantity,
    }],
    total: 2500 * quantity,
    skipped: [],
  };
}

/**
 * Корзина, которая помнит положенное: после добавления её перечитывают,
 * и плоское правило вернуло бы пустую — карточка честно показала бы кнопку
 * снова, а проверка ловила бы заглушку.
 */
function rememberingCart(afterAdding: unknown): StubbedResponse[] {
  let state: unknown = emptyCart;
  return [
    {
      match: (url, init) => url.includes('/api/portal/cart/lines/') && init?.method === 'PUT',
      get body() {
        state = afterAdding;
        return state;
      },
    },
    {
      match: (url, init) => url.includes('/api/portal/cart') && (init?.method ?? 'GET') === 'GET',
      get body() {
        return state;
      },
    },
  ];
}

function cardRules(card: unknown = CARD, reviews: unknown[] = [], cart: unknown = emptyCart) {
  return [
    get('/api/portal/catalog/item-1', card),
    get('/api/portal/items/item-1/reviews', reviews),
    get('/api/portal/cart', cart),
  ];
}

function renderCard() {
  return renderScreen(
    <Routes>
      <Route path="/catalog/:itemId" element={<ItemCardPage />} />
    </Routes>,
    { route: '/catalog/item-1' },
  );
}

/** Куда увела кнопка вопроса: путь с запросом. */
function Where() {
  const { pathname, search } = useLocation();
  return <h1>{pathname + search}</h1>;
}

/** Карточка и переписка: вопрос о товаре ведёт в «Вопрос продавцу». */
function renderCardWithQuestions() {
  return renderScreen(
    <Routes>
      <Route path="/catalog/:itemId" element={<ItemCardPage />} />
      <Route path="/questions/*" element={<Where />} />
    </Routes>,
    { route: '/catalog/item-1' },
  );
}

describe('карточка товара', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Характеристики рубрики идут выше прочих свойств: их продавец заводил
   * шаблоном отрасли и заполняет у каждой позиции, а прочие свойства —
   * то разовое, чему поля не завели. Клиенту разница не объясняется, поэтому
   * список один, а порядок в нём и есть объяснение.
   *
   * Внутренних характеристик здесь нет ни в каком виде: сервер их не отдаёт,
   * и проверять их отсутствие на экране нечем — это закреплено на сервере.
   */
  it('позиции нет — «Сообщить о поступлении»; нажатие подписывает, кнопка говорит «Сообщим»', async () => {
    let waiting: string[] = [];
    const { calls } = stubFetch([
      get('/api/portal/catalog/item-1/substitutes', []),
      ...cardRules({ ...CARD, stock: 'OUT_OF_STOCK' }),
      { match: (url, init) => url.includes('/api/portal/restock-subscriptions') && (init?.method ?? 'GET') === 'GET', get body() { return waiting; } },
      { match: (url, init) => url.includes('/api/portal/restock-subscriptions/item-1') && init?.method === 'PUT',
        get body() { waiting = ['item-1']; return undefined; }, status: 204 },
    ]);
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Сообщить о поступлении' }));

    expect(await screen.findByRole('button', { name: 'Сообщим, когда появится' })).toHaveAttribute('aria-pressed', 'true');
    expect(calls.some((call) => call.url.includes('/restock-subscriptions/item-1') && call.init?.method === 'PUT')).toBe(true);
  });

  it('позиции нет — выше отзывов «можно заменить» с тем, что есть в наличии', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1/substitutes', [
        { id: 'item-2', name: 'Цемент М500', unit: 'мешок', price: 2700, stock: 'IN_STOCK', favorite: false },
      ]),
      { match: (url) => url.includes('/api/portal/restock-subscriptions'), body: [] },
      ...cardRules({ ...CARD, stock: 'OUT_OF_STOCK' }),
    ]);
    renderCard();

    const block = await screen.findByRole('region', { name: 'Есть в наличии — можно заменить' });
    expect(within(block).getByRole('link', { name: /Цемент М500/ })).toHaveAttribute('href', '/catalog/item-2');
  });

  it('в наличии — кнопки поступления нет', async () => {
    stubFetch(cardRules());
    renderCard();

    expect(await screen.findByTestId('stock-pill')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сообщить о поступлении' })).toBeNull();
  });

  it('открытая по ссылке с #reviews прокручивается к отзывам, когда они загружены', async () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      stubFetch(cardRules(CARD, [
        { id: 'r1', rating: 5, text: 'Хороший', status: 'PUBLISHED', mine: false, createdAt: '2026-09-01T10:00:00Z' },
      ]));
      renderScreen(
        <Routes>
          <Route path="/catalog/:itemId" element={<ItemCardPage />} />
        </Routes>,
        { route: '/catalog/item-1#reviews' },
      );

      await waitFor(() => expect(scroll).toHaveBeenCalled());
      const target = scroll.mock.contexts[0] as HTMLElement;
      expect(target.id).toBe('reviews');
      expect(scroll.mock.calls[0][0]).toMatchObject({ block: 'start' });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('без #reviews в адресе к отзывам не прокручивает', async () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      stubFetch(cardRules());
      renderCard();
      await screen.findByRole('heading', { level: 1, name: 'Цемент М400' });
      await screen.findByRole('heading', { name: /Отзывы/ });
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('«Спросить продавца» и «В избранное» растут в высоту, когда подпись переносится', async () => {
    stubFetch(cardRules());
    renderCard();

    await screen.findByRole('heading', { level: 1, name: 'Цемент М400' });
    for (const name of ['Спросить продавца', 'В избранное']) {
      // Сердечко на снимке называется так же; нужна кнопка с подписью.
      const [button] = screen.getAllByRole('button', { name }).filter((one) => one.textContent?.includes(name));
      expect(button).not.toHaveClass('h-[52px]');
      expect(button).toHaveClass('min-h-[52px]', 'px-3', 'py-1', 'leading-[1.15]', 'text-center');
    }
  });

  it('под названием — артикул цвета; без артикула строки нет', async () => {
    stubFetch(cardRules({ ...CARD, article: 'TS-BLK' }));
    renderCard();
    expect(await screen.findByTestId('model-articles')).toHaveTextContent(/^Арт\. TS-BLK$/);
  });

  it('артикулы всех цветов модели: открытый первым, больше трёх — «Показать все»', async () => {
    const colour = (itemId: string, value: string, article: string) => ({
      itemId, price: 100, article, fields: [{ code: 'COLOR', name: 'Цвет', type: 'TEXT', value }],
    });
    stubFetch(cardRules({ ...CARD, article: 'AZA01-M', variants: [
      colour('item-1', 'Мокко', 'AZA01-M'), colour('b', 'Чёрный', 'AZA01-BL'), colour('c', 'Коричневый', 'AZA01-BR'), colour('d', 'Синий', 'AZA01-BU'),
    ] }));
    renderCard();
    const line = await screen.findByTestId('model-articles');
    expect(line).toHaveTextContent(/^Арт\. AZA01-M, AZA01-BL, AZA01-BRПоказать все \(4\)$/);
    await userEvent.click(within(line).getByRole('button', { name: 'Показать все (4)' }));
    expect(line).toHaveTextContent('AZA01-BU');
    expect(within(line).getByRole('button', { name: 'Свернуть' })).toBeInTheDocument();
    // Артикул другого цвета — ссылка на его карточку, открытый — не ссылка (2026-11-20).
    expect(within(line).getByRole('link', { name: 'AZA01-BL' })).toHaveAttribute('href', '/catalog/b');
    expect(within(line).queryByRole('link', { name: 'AZA01-M' })).toBeNull();
  });

  it('показывает характеристики рубрики выше прочих свойств', async () => {
    stubFetch(cardRules({
      ...CARD,
      fields: [
        { code: 'SIZE', name: 'Размер', type: 'OPTION', value: 'M' },
        { code: 'COMPOSITION', name: 'Состав', type: 'TEXT', value: 'Полиэстер 100%' },
        { code: 'VOLUME', name: 'Объём', type: 'NUMBER', value: '1.5', unit: 'л' },
        { code: 'EMPTY', name: 'Незаполненная', type: 'TEXT', value: '' },
      ],
    }));

    renderCard();

    expect(await screen.findByRole('heading', { name: 'Цемент М400' })).toBeInTheDocument();

    const rows = screen.getAllByTestId('item-property');
    expect(rows.map((row) => row.textContent)).toEqual([
      'РазмерM',
      'СоставПолиэстер 100%',
      'Объём1.5 л',
      'МаркаМ400',
      'Вес50 кг',
      // «Продаётся — в единицах «мешок»» не выводится: единица видна у цены (2026-11-06).
    ]);

    // Характеристика без значения заняла бы строку сообщением ни о чём.
    expect(screen.queryByText('Незаполненная')).not.toBeInTheDocument();
  });

  it('показывает снимки, свойства и оценку, а количество вводится не выходя из карточки', async () => {
    const { calls } = stubFetch([
      ...cardRules(),
      method('PUT', '/api/portal/cart/lines/item-1', {
        lines: [{
          itemId: 'item-1', name: 'Цемент М400', quantity: 3, unit: 'мешок',
          priceAtAdding: 2500, price: 2500, priceChanged: false, total: 7500,
        }],
        total: 7500,
        skipped: [],
      }),
    ]);

    renderCard();

    expect(await screen.findByRole('heading', { name: 'Цемент М400' })).toBeInTheDocument();
    // Снимок — картинкой, ролик — меткой: видео не грузится само, пока
    // на него не нажали, иначе карточка съедала бы мобильный трафик.
    expect(screen.getByRole('img', { name: 'Мешок 50 кг' })).toHaveAttribute(
      'src', 'https://cdn.example/cement.jpg',
    );
    // Метка на кадре и миниатюра в ленте — обе кнопки, ни одна не проигрыватель.
    expect(screen.getByRole('button', { name: 'Видео' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Видео 1' })).toBeInTheDocument();

    // Свойства — то, по чему сравнивают две похожие позиции.
    expect(screen.getByText('Марка')).toBeInTheDocument();
    expect(screen.getByText('М400')).toBeInTheDocument();

    // Оценка называет и число отзывов: 4,5 по двум отзывам и 4,5 по двум
    // сотням — разные утверждения.
    expect(screen.getByTestId('item-rating')).toHaveTextContent('4,5');
    expect(screen.getByTestId('item-rating')).toHaveTextContent('2');

    // Количество набирается до корзины: «+» дважды — три мешка и сумма сразу.
    await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
    await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
    expect(screen.getByTestId('item-sum')).toHaveTextContent('7 500 ₸');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'PUT');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 3 });
    }, { timeout: 3000 });
  });

  it('карточка пресса показывает состав по нажатию', async () => {
    stubFetch(cardRules({
      ...CARD, name: 'Худи — пресс', unit: 'пресс',
      pack: [{ itemId: 's', name: 'Худи', variantLabel: 'S', quantity: 1, unit: 'шт' }],
    }));
    renderCard();

    const toggle = await screen.findByRole('button', { name: 'Что внутри' });
    expect(screen.getByTestId('pack-contents')).not.toBeVisible();
    await userEvent.click(toggle);
    expect(screen.getByTestId('pack-contents')).toHaveTextContent('Худи · S');
  });

  describe('опт', () => {
    /** Розница 100 за мешок, упаковка = 2 мешка, от 2 упаковок — 180, от 3 — 170. */
    const WHOLESALE = {
      unit: 'упаковка', packQty: 2, pieceUnit: 'мешок', retail: true,
      tiers: [{ from: 2, price: 180 }, { from: 3, price: 170 }],
    };
    const BOTH = { ...CARD, price: 100, wholesale: WHOLESALE };

    it('одежда: состав линейки — только в «Оптом», в «В розницу» его нет', async () => {
      const LINE = {
        pieces: 3, linePrice: 300, piecePrice: 100,
        sizes: [{ label: '48', quantity: 1, missing: false }, { label: '50', quantity: 2, missing: false }, { label: '52', quantity: 1, missing: true }],
      };
      stubFetch(cardRules({ ...BOTH, sizeGuide: 'CLOTHING', line: LINE }));
      renderCard();

      await screen.findByRole('button', { name: /^В розницу/ });
      expect(screen.queryByTestId('card-line')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /^Оптом/ }));
      const line = await screen.findByTestId('card-line');
      expect(line).toHaveTextContent('48');
      expect(line).toHaveTextContent('2 шт');
      expect(line).toHaveTextContent(/Линейка 3 шт — 300/);
      // Размера нет — зачёркнут и подписан «нет»: линейка уйдёт без него.
      expect(within(line).getByText('52')).toHaveClass('line-through');
      expect(line).toHaveTextContent('нет');
    });

    it('одежда оптом: состав линейки — таблицей RUS, INT, EUR и штук; незаполненное продавцом — прочерк', async () => {
      const LINE = { pieces: 2, linePrice: 200, piecePrice: 100,
        sizes: [{ label: '48', quantity: 1, missing: false }, { label: '50', quantity: 1, missing: true }] };
      const CHART = { sizes: [{ code: 'RU48', label: '48', intl: 'M' }, { code: 'RU50', label: '50', intl: 'L' }],
        rows: [{ measure: 'EUR', values: { RU48: '42' } }] };
      stubFetch(cardRules({ ...BOTH, sizeGuide: 'CLOTHING', line: LINE, sizeChart: CHART }));
      renderCard();

      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      const table = await screen.findByTestId('card-line-table');
      expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['RUS', 'INT', 'EUR', 'В линейке']);
      const [, first, second] = within(table).getAllByRole('row');
      expect(first).toHaveTextContent(/48\s*M\s*42\s*1 шт/);
      // У 50 EUR продавец не заполнил — прочерк; размера нет — зачёркнут и «нет».
      expect(second).toHaveTextContent(/50\s*L\s*—\s*нет/);
      expect(within(second).getByRole('rowheader')).toHaveClass('line-through');
    });

    it('одежда оптом: размеры буквами — RUS, INT, EUR по сетке модели; заполненное продавцом главнее', async () => {
      const LINE = { pieces: 2, linePrice: 200, piecePrice: 100,
        sizes: [{ label: 'XS', quantity: 1, missing: false }, { label: 'XL', quantity: 1, missing: false }] };
      // Продавец вписал EUR только у XS — у XL EUR берётся по женской сетке (EUR = RUS − 6).
      const CHART = { sizes: [{ code: 'XS', label: 'XS' }, { code: 'XL', label: 'XL' }], rows: [{ measure: 'EUR', values: { XS: '32' } }] };
      stubFetch(cardRules({ ...BOTH, sizeGuide: 'CLOTHING', line: LINE, sizeChart: CHART, sizeGrid: 'WOMEN' }));
      renderCard();

      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      const [, xs, xl] = within(await screen.findByTestId('card-line-table')).getAllByRole('row');
      expect(xs).toHaveTextContent(/^40\s*XS\s*32\s*1 шт$/);
      expect(xl).toHaveTextContent(/^52\s*XL\s*46\s*1 шт$/);
    });

    it('линейка: «Отдельные размеры — в розницу» — только у товара, который продаётся и в розницу', async () => {
      const LINE = { pieces: 6, linePrice: 60000, piecePrice: 10000, sizes: [{ label: '48', quantity: 1, missing: false }] };
      const wholesale = (retail: boolean) => ({
        unit: 'линейка', packQty: 6, linePieces: 6, pieceUnit: 'шт', retail, tiers: [{ from: 1, price: 60000 }],
      });
      stubFetch(cardRules({ ...CARD, price: 12000, sizeGuide: 'CLOTHING', wholesale: wholesale(false), line: LINE }));
      const { unmount } = renderCard();
      expect(await screen.findByText('Оптом — только линейкой, все размеры сразу.')).toBeInTheDocument();
      unmount();

      stubFetch(cardRules({ ...CARD, price: 12000, sizeGuide: 'CLOTHING', wholesale: wholesale(true), line: LINE }));
      renderCard();
      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      expect(await screen.findByText(/Отдельные размеры — в розницу/)).toBeInTheDocument();
    });

    it('одежда оптом: три варианта линеек с ценой штуки, ценой линейки и суммой; выбор меняет сумму кнопки', async () => {
      // Розница 12 000 за шт; линейка 6 шт — 60 000, от 5 линеек — 54 000. Ступеней две — третьим встаёт «3 линейки».
      const LINE_WHOLESALE = {
        unit: 'линейка', packQty: 6, linePieces: 6, pieceUnit: 'шт', retail: true,
        tiers: [{ from: 1, price: 60000 }, { from: 5, price: 54000 }],
      };
      const LINE = { pieces: 6, linePrice: 60000, piecePrice: 10000, sizes: [{ label: '48', quantity: 1, missing: false }] };
      stubFetch(cardRules({ ...CARD, price: 12000, sizeGuide: 'CLOTHING', wholesale: LINE_WHOLESALE, line: LINE }));
      renderCard();

      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      const tiers = await screen.findAllByTestId('line-tier');
      // Каждый вариант — подписанными строками: штук всего, цена штуки, цена за все линейки, выгода; «Итого» в заголовке нет.
      expect(screen.getByTestId('line-tiers')).not.toHaveTextContent('Итого');
      expect(tiers[0]).toHaveTextContent(/1 линейка.*Штук всего\s*6 шт.*Цена за 1 шт\s*10\s000.*Цена за 1 линейку\s*60\s000/);
      expect(tiers[1]).toHaveTextContent(/3 линейки.*18 шт \(3 × 6\).*Цена за 3 линейки\s*180\s000/);
      expect(tiers[1]).not.toHaveTextContent('Ваша выгода');
      expect(tiers[2]).toHaveTextContent(/5 линеек.*30 шт \(5 × 6\).*9\s000.*Цена за 5 линеек\s*270\s000.*Ваша выгода\s*30\s000/);
      expect(screen.getByTestId('line-tiers')).toHaveTextContent('В одной линейке — 6 шт');
      // Выгода к рознице — одной строкой над вариантами, с розничной ценой; в вариантах метки нет.
      expect(screen.getByTestId('line-tiers-retail')).toHaveTextContent(/В розницу 12\s000 ₸ за шт — оптом дешевле до 25%/);
      expect(tiers[0]).not.toHaveTextContent('к рознице');
      expect(tiers[0]).toHaveAttribute('aria-current', 'true');
      expect(screen.getByTestId('line-tiers-next')).toHaveTextContent(/Ещё 4 линейки — и будет 9\s000 ₸ за шт/);

      await userEvent.click(within(tiers[1]).getByRole('button'));
      expect(screen.getAllByTestId('line-tier')[1]).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('button', { name: /В корзину линейкой/ })).toHaveTextContent(/180\s000/);
    });

    it('выгода к рознице — по вариантам, которые хватит остатка взять, и с округлением вниз', async () => {
      // Розница 12 000; 1 и 3 линейки — по 10 000 за шт (16,7%), от 5 — 9 000 (25%), но свободно только 3 линейки.
      const LINE_WHOLESALE = {
        unit: 'линейка', packQty: 6, linePieces: 6, pieceUnit: 'шт', retail: true,
        tiers: [{ from: 1, price: 60000 }, { from: 5, price: 54000 }],
      };
      const LINE = { pieces: 6, linePrice: 60000, piecePrice: 10000, availableLines: 3, sizes: [{ label: '48', quantity: 1, missing: false }] };
      stubFetch(cardRules({ ...CARD, price: 12000, sizeGuide: 'CLOTHING', wholesale: LINE_WHOLESALE, line: LINE }));
      renderCard();

      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      // Не «до 25%» за выключенный вариант и не «на 17%» округлением вверх.
      expect(await screen.findByTestId('line-tiers-retail')).toHaveTextContent(/В розницу 12\s000 ₸ за шт — оптом дешевле на 16%\.$/);
    });

    it('ровная выгода к рознице не теряет процент при округлении вниз', async () => {
      // Розница 10 000, линейка 6 шт — 54 000 (9 000 за шт): ровно 10%, а не 9% из-за 9,999…
      const LINE_WHOLESALE = { unit: 'линейка', packQty: 6, linePieces: 6, pieceUnit: 'шт', retail: true, tiers: [{ from: 1, price: 54000 }] };
      const LINE = { pieces: 6, linePrice: 54000, piecePrice: 9000, sizes: [{ label: '48', quantity: 1, missing: false }] };
      stubFetch(cardRules({ ...CARD, price: 10000, sizeGuide: 'CLOTHING', wholesale: LINE_WHOLESALE, line: LINE }));
      renderCard();

      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      expect(await screen.findByTestId('line-tiers-retail')).toHaveTextContent(/оптом дешевле на 10%\.$/);
    });

    it('одежда оптом: только полные линейки — нет полной линейки, «В корзину» выключена; варианты сверх наличия выключены', async () => {
      const LINE_WHOLESALE = {
        unit: 'линейка', packQty: 6, linePieces: 6, pieceUnit: 'шт', retail: false,
        tiers: [{ from: 1, price: 60000 }, { from: 5, price: 54000 }],
      };
      const line = (availableLines: number) => ({ pieces: 6, linePrice: 60000, piecePrice: 10000, availableLines,
        sizes: [{ label: '48', quantity: 1, missing: availableLines === 0 }] });
      stubFetch(cardRules({ ...CARD, price: 12000, sizeGuide: 'CLOTHING', wholesale: LINE_WHOLESALE, line: line(0) }));
      const { unmount } = renderCard();
      expect(await screen.findByTestId('line-available')).toHaveTextContent('Полной линейки нет в наличии');
      expect(screen.getByRole('button', { name: /В корзину линейкой/ })).toBeDisabled();
      // Ступень «от 5» не взять — подсказки «ещё 4 линейки — дешевле» нет.
      expect(screen.queryByTestId('line-tiers-next')).not.toBeInTheDocument();
      unmount();

      stubFetch(cardRules({ ...CARD, price: 12000, sizeGuide: 'CLOTHING', wholesale: LINE_WHOLESALE, line: line(3) }));
      const { unmount: unmount2 } = renderCard();
      expect(await screen.findByTestId('line-available')).toHaveTextContent('Полных линеек в наличии: 3');
      const tiers = screen.getAllByTestId('line-tier');
      expect(within(tiers[1]).getByRole('button')).toBeEnabled();
      expect(within(tiers[2]).getByRole('button')).toBeDisabled();
      expect(screen.getByRole('button', { name: /В корзину линейкой/ })).toBeEnabled();
      unmount2();

      // Наличие меньше первой ступени: линейки есть, но минимум опта не набрать — так и сказано.
      stubFetch(cardRules({ ...CARD, price: 12000, sizeGuide: 'CLOTHING', wholesale: { ...LINE_WHOLESALE, tiers: [{ from: 7, price: 60000 }] }, line: line(3) }));
      renderCard();
      expect(await screen.findByTestId('line-available')).toHaveTextContent('Полных линеек в наличии: 3, а оптом — от 7');
      expect(screen.getByRole('button', { name: /В корзину линейкой/ })).toBeDisabled();
    });

    it('«Свободно» одежды: в «Оптом» — полными линейками, в «В розницу» — штуками размера', async () => {
      const LINE_WHOLESALE = {
        unit: 'линейка', packQty: 6, linePieces: 6, pieceUnit: 'шт', retail: true,
        tiers: [{ from: 1, price: 60000 }],
      };
      const LINE = { pieces: 6, linePrice: 60000, piecePrice: 10000, availableLines: 2, sizes: [{ label: '48', quantity: 1, missing: false }] };
      stubFetch(cardRules({ ...CARD, price: 12000, unit: 'шт', available: 6, sizeGuide: 'CLOTHING', wholesale: LINE_WHOLESALE, line: LINE }));
      renderCard();

      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      expect(screen.getByTestId('stock-pill')).toHaveTextContent('Свободно: 2 линейки (12 шт.)');
      await userEvent.click(screen.getByRole('button', { name: /^В розницу/ }));
      expect(screen.getByTestId('stock-pill')).toHaveTextContent('Свободно: 6 шт.');
    });

    it('товар только в розницу в магазине обоих способов — без вкладок «Оптом» / «В розницу», сразу покупка', async () => {
      stubFetch([
        get('/api/portal/catalog/counts', { all: 2, sale: 0, novelty: 0, byCategory: {}, retail: 1, wholesale: 1, both: 0 }),
        ...cardRules(CARD),
      ]);
      renderCard();

      expect(await screen.findByRole('button', { name: /в корзину/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Оптом' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'В розницу' })).not.toBeInTheDocument();
      expect(screen.queryByText('Этот товар продаётся только в розницу')).not.toBeInTheDocument();
    });

    it('открытая карточка товара только в розницу блокирует «Оптом» в шапке', async () => {
      stubFetch([
        get('presence=ALL', { all: 2, sale: 0, novelty: 0, byCategory: {}, retail: 1, wholesale: 1, both: 0 }),
        get('/api/portal/catalog/counts', { all: 1, sale: 0, novelty: 0, byCategory: {} }),
        ...cardRules(CARD),
      ]);
      renderScreen(
        <><HeaderOrderMode /><Routes><Route path="/catalog/:itemId" element={<ItemCardPage />} /></Routes></>,
        { route: '/catalog/item-1' },
      );
      await screen.findByRole('button', { name: /в корзину/i });
      const group = await screen.findByRole('radiogroup', { name: 'Как заказываете: оптом или в розницу' });
      expect(within(group).getByRole('radio', { name: /Оптом/ })).toBeDisabled();
      expect(within(group).getByRole('radio', { name: /В розницу/ })).toHaveAttribute('aria-checked', 'true');
    });

    it('«В розницу» по умолчанию — без условий опта; «Оптом» — условия, сумма и разбиение, строка уходит с режимом', async () => {
      const { calls } = stubFetch(cardRules(BOTH));
      renderCard();

      const retail = await screen.findByRole('button', { name: /^В розницу/ });
      expect(retail).toHaveAttribute('aria-pressed', 'true');
      // В «В розницу» об опте не говорится ничего — даже ценой на переключателе (решение владельца 2026-11-06).
      expect(screen.getByRole('button', { name: /^Оптом/ })).toHaveTextContent(/^Оптом$/);
      expect(screen.queryByText(/за упаковку|от 85 ₸/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('wholesale-terms')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /^Оптом/ }));

      const terms = await screen.findByTestId('wholesale-terms');
      expect(within(terms).getByText('Оптовые цены')).toBeInTheDocument();
      expect(terms).toHaveTextContent('1 упаковка = 2 мешка');
      // Крупно — цена за мешок и выгода к рознице, мельче — цена упаковки.
      const [first] = within(terms).getAllByTestId('wholesale-tier');
      expect(first).toHaveTextContent(/от 2 упаковок\s*4 мешка\s*−10%\s*90 ₸\s*за мешок\s*180 ₸ за упаковку/);
      expect(terms).toHaveTextContent('При меньшем количестве — по розничной цене 100 ₸ за мешок');
      expect(screen.queryByRole('radiogroup', { name: 'Как покупать' })).not.toBeInTheDocument();
      // В «Оптом» счётчик сразу на первой ступени — 2 упаковки = 4 мешка, а не минимум розницы (2026-11-15).
      expect(screen.getByTestId('item-sum')).toHaveTextContent(/360 ₸/);
      expect(screen.getByTestId('wholesale-split')).toHaveTextContent(/4 мешка = 2 упаковки × 180 ₸/);

      expect(screen.getAllByTestId('wholesale-tier')[0]).toHaveAttribute('aria-current', 'true');

      // В «Оптом» «+» добавляет упаковку (2 мешка), а не мешок: 6 мешков = 3 упаковки по 170.
      await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
      expect(screen.getByTestId('item-sum')).toHaveTextContent(/510 ₸/);
      expect(screen.getAllByTestId('wholesale-tier')[1]).toHaveAttribute('aria-current', 'true');

      await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));
      await waitFor(() => {
        const sent = calls.find((call) => call.init?.method === 'PUT');
        expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 6, mode: 'WHOLESALE' });
      });
    });

    it('«В розницу» кладёт по розничной цене: сумма без опта, режим RETAIL', async () => {
      const { calls } = stubFetch(cardRules(BOTH));
      renderCard();

      await screen.findByRole('button', { name: /^В розницу/ });
      for (let i = 0; i < 5; i += 1) await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
      expect(screen.getByTestId('item-sum')).toHaveTextContent(/600 ₸/);
      expect(screen.queryByTestId('wholesale-split')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));
      await waitFor(() => {
        const sent = calls.find((call) => call.init?.method === 'PUT');
        expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 6, mode: 'RETAIL' });
      });
    });

    it('нажатая ступень опта подставляет её количество; отдельной «Оптом в корзину» у товара без размеров нет', async () => {
      stubFetch(cardRules(BOTH));
      renderCard();

      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      expect(screen.queryByRole('button', { name: /Оптом в корзину|Разложить минимум/ })).not.toBeInTheDocument();
      await userEvent.click(within(screen.getAllByTestId('wholesale-tier')[1]).getByRole('button'));
      // 3 упаковки = 6 мешков по 170 за упаковку.
      expect(screen.getByTestId('item-sum')).toHaveTextContent(/510 ₸/);
      expect(screen.getAllByTestId('wholesale-tier')[1]).toHaveAttribute('aria-current', 'true');
      expect(screen.queryByTestId('wholesale-next')).not.toBeInTheDocument();
    });

    // Скидка клиента опт не снимает (2026-11-15): сервер отдаёт опт уже со скидкой — выбор «Оптом / В розницу» есть.
    it('скидка клиента — «ваша цена», и опт с выбором остаётся', async () => {
      stubFetch(cardRules({ ...BOTH, yourPrice: true }));
      renderCard();

      expect(await screen.findByTestId('item-your-price')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Оптом/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^В розницу/ })).toBeInTheDocument();
    });

    // Своя цена клиента — только розница: сервер присылает позицию без опта.
    it('своя цена клиента — без опта и без выбора', async () => {
      stubFetch(cardRules({ ...BOTH, yourPrice: true, wholesale: undefined }));
      renderCard();

      expect(await screen.findByTestId('item-your-price')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Оптом/ })).not.toBeInTheDocument();
    });

    it('распродажа без скидки на опт — пометка в условиях', async () => {
      stubFetch(cardRules({ ...BOTH, price: 90, oldPrice: 100, discountPercent: 10 }));
      renderCard();

      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      expect(await screen.findByText('Скидка распродажи — только при заказе штуками')).toBeInTheDocument();
    });

    it('товар «только опт» — счёт упаковками, в корзину уходят штуки', async () => {
      const { calls } = stubFetch(cardRules({
        ...CARD, unit: 'упаковка', price: 1800,
        terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 5, quantityStep: 1 },
        wholesale: { ...WHOLESALE, packQty: 20, retail: false, tiers: [{ from: 5, price: 1800 }, { from: 10, price: 1700 }] },
      }));
      renderCard();

      expect(await screen.findByTestId('wholesale-terms')).toHaveTextContent('Продаётся только упаковками, минимум — 5 упаковок');
      expect(screen.getByTestId('item-sum')).toHaveTextContent(/9\s000 ₸/);
      expect(screen.getByTestId('wholesale-split')).toHaveTextContent(/100 мешков = 5 упаковок × 1\s800 ₸/);

      await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));
      await waitFor(() => {
        const sent = calls.find((call) => call.init?.method === 'PUT');
        expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 100 });
      });
    });

    it('товар «только опт» при «В розницу» в шапке — та же оптовая карточка, без вкладок способа', async () => {
      stubFetch([
        get('/api/portal/catalog/counts', { all: 2, sale: 0, novelty: 0, byCategory: {}, retail: 1, wholesale: 1, both: 0 }),
        ...cardRules({
          ...CARD, unit: 'упаковка', price: 1800,
          terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 5, quantityStep: 1 },
          wholesale: { ...WHOLESALE, packQty: 20, retail: false, tiers: [{ from: 5, price: 1800 }, { from: 10, price: 1700 }] },
        }),
      ]);
      Object.keys(localStorage).filter((key) => key.startsWith('qo.orderMode.')).forEach((key) => localStorage.setItem(key, 'RETAIL'));
      renderCard();

      expect(await screen.findByTestId('wholesale-terms')).toHaveTextContent('Продаётся только упаковками');
      expect(screen.queryByRole('button', { name: 'Оптом' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'В розницу' })).not.toBeInTheDocument();
    });

    it('линейка продаётся сама собой: «за линейку», без строки «1 линейка = 1 линейка × цена»', async () => {
      stubFetch(cardRules({
        ...CARD, unit: 'линейка', price: 80000,
        terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 1, quantityStep: 1 },
        wholesale: { ...WHOLESALE, unit: 'линейка', pieceUnit: 'линейка', packQty: 1, retail: false, tiers: [{ from: 1, price: 80000 }] },
      }));
      renderCard();

      expect(await screen.findByTestId('wholesale-terms')).toHaveTextContent('за линейку');
      expect(screen.queryByTestId('wholesale-split')).not.toBeInTheDocument();
    });
  });

  it('выбранный размер — сразу своя цена и снимки, пока его карточка ещё едет', async () => {
    const variant = (itemId: string, size: string, price: number, media: unknown[] = []) => ({
      itemId, price, media, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch([
      ...cardRules({ ...CARD, variants: [variant('item-1', 'S', 2500), variant('item-2', 'M', 2700, [
        { id: 'm9', kind: 'PHOTO', source: 'LINK', url: 'https://cdn.example/m.jpg', title: 'Размер M', sortOrder: 10 },
      ])] }),
      get('/api/portal/items/item-2/reviews', []),
    ]);
    // Карточка размера M не приходит вовсе: всё, что видно, — из варианта.
    const stubbed = globalThis.fetch;
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => (
      String(input).endsWith('/api/portal/catalog/item-2') ? new Promise(() => {}) : stubbed(input, init)));
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'M' }));

    expect(await screen.findByText(/2\s700 ₸/, { selector: '[data-testid="item-price"] span' })).toBeInTheDocument();
    expect(screen.queryByTestId('card-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'M' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('img').some((img) => img.getAttribute('src')?.includes('m.jpg'))).toBe(true);
  });

  it('пустая оценка приходит как null и не роняет карточку', async () => {
    // Сервер присылает незаполненное поле именно так — null, а не отсутствием
    // ключа. Проверка «не undefined» пропускает его, и карточка падает целиком:
    // клиент видит пустой экран вместо товара.
    stubFetch(cardRules({
      ...CARD,
      description: null,
      priceAsOf: null,
      available: null,
      rating: null,
      reviewCount: null,
    }));

    renderCard();

    expect(await screen.findByRole('heading', { name: 'Цемент М400' })).toBeInTheDocument();
    // Без оценок значок говорит об этом словами и ведёт к отзывам.
    expect(screen.getByTestId('item-rating')).toHaveTextContent('Отзывов пока нет');
  });

  it('отзыв отправляется с оценкой и текстом, а свой неодобренный виден с пометкой', async () => {
    const mine = {
      id: 'r1',
      itemId: 'item-1',
      rating: 5,
      text: 'Хороший цемент',
      status: 'PENDING',
      createdAt: '2026-09-01T10:00:00Z',
      tags: [],
      helpful: 0,
      helpfulByMe: false,
      mine: true,
    };
    const { calls } = stubFetch([
      ...cardRules(CARD, []),
      method('POST', '/api/portal/items/item-1/reviews', mine, 201),
    ]);

    renderCard();

    await userEvent.click(await screen.findByRole('radio', { name: /^Оценка 5 из 5/ }));
    await userEvent.type(screen.getByLabelText(/Расскажите подробнее/), 'Хороший цемент');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(sent).toBeDefined();
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ rating: 5, text: 'Хороший цемент' });
    });

    // Отзыв показывается сразу, но честно: до одобрения его видит только автор.
    expect(await screen.findByText(/ждёт проверки/i)).toBeInTheDocument();
  });

  it('клиент без заявки видит форму «Оцените товар» без строки о покупке и может отправить отзыв', async () => {
    // Товар могли купить и вне системы: оценить его может любой клиент магазина.
    const mine = {
      id: 'r1', itemId: 'item-1', rating: 4, status: 'PENDING', createdAt: '2026-09-01T10:00:00Z',
      tags: [], helpful: 0, helpfulByMe: false, mine: true, verifiedPurchase: false,
    };
    const { calls } = stubFetch([
      ...cardRules({ ...CARD, purchaseOrderNumber: undefined, purchasedAt: undefined }),
      method('POST', '/api/portal/items/item-1/reviews', mine, 201),
    ]);

    renderCard();

    expect(await screen.findByText('Оцените товар')).toBeInTheDocument();
    expect(screen.queryByText('Оцените заказанный товар')).not.toBeInTheDocument();
    expect(screen.queryByText(/Вы заказывали этот товар/)).not.toBeInTheDocument();
    expect(screen.queryByText(/после покупки/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Мои заявки/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /^Оценка 4 из 5/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));
    await waitFor(() => expect(calls.some((call) => call.init?.method === 'POST')).toBe(true));
    expect(await screen.findByText('Спасибо за отзыв!')).toBeInTheDocument();
  });

  it('покупатель с заявкой видит «Оцените заказанный товар» и строку «Вы заказывали · заявка №…»', async () => {
    stubFetch(cardRules({ ...CARD, purchaseOrderNumber: '2026-00042', purchasedAt: '2026-09-12T10:00:00Z' }));

    renderCard();

    expect(await screen.findByText('Оцените заказанный товар')).toBeInTheDocument();
    expect(screen.getByText(/Вы заказывали этот товар · заявка №2026-00042/)).toBeInTheDocument();
  });

  it('цена набрана крупно, ставка — отдельной строкой, даты цены нет', async () => {
    stubFetch(cardRules());

    renderCard();

    // Цена и единица — одной строкой: «2 500 ₸» без «за мешок» ничего
    // не значит, когда рядом лежит цена за тонну.
    const price = await screen.findByTestId('item-price');
    expect(price).toHaveTextContent('2 500 ₸');
    expect(price).toHaveTextContent('за мешок');

    expect(screen.getByText('без НДС, НДС 12% прибавляется сверху')).toBeInTheDocument();
    // «Цена на 04.09» в карточке не пишется (просьба владельца 2026-11-06).
    expect(screen.queryByText(/цена на/)).not.toBeInTheDocument();
  });

  it('в другой валюте магазина цена, «Сумма» и подсказка объёма — с её знаком', async () => {
    stubFetch(cardRules());

    renderScreen(
      <Routes>
        <Route path="/catalog/:itemId" element={<ItemCardPage />} />
      </Routes>,
      { route: '/catalog/item-1', currency: 'RUB' },
    );

    const price = await screen.findByTestId('item-price');
    expect(price).toHaveTextContent('2 500 ₽');
    expect(screen.getByTestId('item-sum')).toHaveTextContent('2 500 ₽');
    expect(price).not.toHaveTextContent('₸');
  });

  it('наличие показано пилюлей, а не строчкой в тексте', async () => {
    stubFetch(cardRules());

    renderCard();

    // Наличие — первое, что ищут глазами после цены, и в макете оно стоит
    // отдельной меткой на подложке, а не теряется среди строк описания.
    expect(await screen.findByTestId('stock-pill')).toHaveTextContent('В наличии');
  });

  it('штучный товар без кратности — пилюля «Продаётся поштучно», в характеристиках не повторяется', async () => {
    stubFetch(cardRules({
      ...CARD,
      unit: 'шт.',
      terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 1, quantityStep: 1 },
    }));

    renderCard();

    expect(await screen.findByText('Продаётся поштучно')).toBeInTheDocument();
    const rows = screen.queryAllByTestId('item-property').map((row) => row.textContent);
    expect(rows.some((row) => row?.startsWith('Продаётся'))).toBe(false);
  });

  it('свойство «Продаётся» от продавца остаётся в характеристиках', async () => {
    stubFetch(cardRules({ ...CARD, attributes: [{ name: 'Продаётся', value: 'на развес' }] }));

    renderCard();

    await screen.findByRole('heading', { name: 'Цемент М400' });
    expect(screen.getAllByTestId('item-property').map((row) => row.textContent)).toEqual(['Продаётсяна развес']);
  });

  it('размер из выбора варианта в характеристиках не повторяется, прочие поля — остаются', async () => {
    const fields = (size: string) => [
      { code: 'SIZE', name: 'Размер', type: 'TEXT', value: size },
      { code: 'SOSTAV', name: 'Состав', type: 'TEXT', value: 'Хлопок' },
    ];
    stubFetch(cardRules({
      ...CARD, fields: fields('S'),
      variants: [{ itemId: 'item-1', price: 2500, fields: fields('S') }, { itemId: 'item-2', price: 2500, fields: fields('M') }],
    }));

    renderCard();

    await screen.findByRole('heading', { name: 'Цемент М400' });
    const rows = screen.getAllByTestId('item-property').map((row) => row.textContent);
    expect(rows).toContain('СоставХлопок');
    expect(rows.some((row) => row?.startsWith('Размер'))).toBe(false);
  });

  it('«Как подобрать размер» открывает подсказку, а из неё — вопрос продавцу', async () => {
    const variant = (itemId: string, size: string) => ({
      itemId, price: 2500, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch(cardRules({ ...CARD, sizeGuide: 'CLOTHING', variants: [variant('item-1', 'S'), variant('item-2', 'M')] }));

    renderCardWithQuestions();

    const link = await screen.findByRole('button', { name: 'Как подобрать размер' });
    await userEvent.click(link);
    const dialog = await screen.findByRole('dialog', { name: 'Как подобрать размер' });
    expect(within(dialog).getByText('Длина по внутреннему шву')).toBeInTheDocument();
    // У каждой мерки — схема, где приложить ленту.
    for (const step of ['chest', 'waist', 'hips', 'inseam']) {
      expect(within(dialog).getByTestId(`size-schema-${step}`)).toBeInTheDocument();
    }
    expect(within(dialog).getByText(/Если сомневаетесь — спросите продавца/)).toBeInTheDocument();

    // Escape закрывает окно и возвращает фокус на ссылку.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(link).toHaveFocus();

    await userEvent.click(link);
    const again = await screen.findByRole('dialog', { name: 'Как подобрать размер' });
    await userEvent.click(within(again).getByRole('button', { name: 'Спросить продавца' }));
    // Вопрос о размере — в переписку с продавцом, новым вопросом об этой позиции.
    expect(await screen.findByRole('heading', { name: '/questions?item=item-1' })).toBeInTheDocument();
  });

  /**
   * Мелкая схема рядом с текстом читается с трудом: нажатие на мерку
   * показывает её схему крупно, а инструкция остаётся рядом. Крупной бывает
   * одна мерка за раз, повторное нажатие её сворачивает.
   */
  it('нажатая мерка показывает свою схему крупно, рядом с инструкцией', async () => {
    const variant = (itemId: string, size: string) => ({
      itemId, price: 2500, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch(cardRules({ ...CARD, sizeGuide: 'CLOTHING', variants: [variant('item-1', 'S'), variant('item-2', 'M')] }));

    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Как подобрать размер' }));
    const dialog = await screen.findByRole('dialog', { name: 'Как подобрать размер' });
    const waist = within(dialog).getByRole('button', { name: /Талия/ });
    const hips = within(dialog).getByRole('button', { name: /Бёдра/ });
    expect(waist).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).getByTestId('size-schema-waist')).toHaveAttribute('data-size', 'small');

    await userEvent.click(waist);
    expect(waist).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByTestId('size-schema-waist')).toHaveAttribute('data-size', 'large');
    // Инструкция — внутри той же мерки, рядом с крупной схемой.
    expect(waist).toHaveTextContent('По самому узкому месту');

    await userEvent.click(hips);
    expect(hips).toHaveAttribute('aria-expanded', 'true');
    expect(waist).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).getByTestId('size-schema-waist')).toHaveAttribute('data-size', 'small');

    await userEvent.click(hips);
    expect(hips).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).getByTestId('size-schema-hips')).toHaveAttribute('data-size', 'small');
  });

  it('с таблицей продавца подсказка объясняет только её мерки', async () => {
    const variant = (itemId: string, size: string) => ({
      itemId, price: 2500, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch(cardRules({
      ...CARD, sizeGuide: 'CLOTHING', variants: [variant('item-1', 'M'), variant('item-2', 'L')],
      sizeChart: { current: 'M', sizes: [{ code: 'M', label: 'M' }, { code: 'L', label: 'L' }],
        rows: [{ measure: 'CHEST', values: { M: '96', L: '104' } }, { measure: 'HEIGHT', values: { M: '176', L: '182' } }] },
    }));

    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Таблица размеров' }));
    const dialog = await screen.findByRole('dialog', { name: 'Таблица размеров' });
    expect(within(dialog).getByRole('button', { name: /Грудь/ })).toBeInTheDocument();
    for (const absent of [/Талия/, /Бёдра/, /Длина по внутреннему шву/]) {
      expect(within(dialog).queryByRole('button', { name: absent })).not.toBeInTheDocument();
    }
  });

  /**
   * Мерки зависят от того, что продаётся: у обуви мерят стопу, у головного
   * убора — обхват головы. Какие именно, говорит сервер по отрасли рубрики.
   */
  it.each([
    ['SHOES', ['Длина стопы', 'Ширина стопы'], ['footLength', 'footWidth'], /Мерьте вечером/],
    ['HEADWEAR', ['Обхват головы'], ['head'], /без шапки/],
  ] as const)('%s — свои мерки и свои схемы', async (sizeGuide, steps, schemas, intro) => {
    const variant = (itemId: string, size: string) => ({
      itemId, price: 2500, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch(cardRules({ ...CARD, sizeGuide, variants: [variant('item-1', '41'), variant('item-2', '42')] }));

    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Как подобрать размер' }));
    const dialog = await screen.findByRole('dialog', { name: 'Как подобрать размер' });
    expect(within(dialog).getByText(intro)).toBeInTheDocument();
    for (const step of steps) {
      expect(within(dialog).getByRole('button', { name: new RegExp(step) })).toBeInTheDocument();
    }
    for (const schema of schemas) {
      expect(within(dialog).getByTestId(`size-schema-${schema}`)).toBeInTheDocument();
    }
    expect(within(dialog).queryByText('Талия')).not.toBeInTheDocument();

    const first = within(dialog).getByRole('button', { name: new RegExp(steps[0]) });
    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByTestId(`size-schema-${schemas[0]}`)).toHaveAttribute('data-size', 'large');
  });

  /** Размер есть, а что мерить — неизвестно (рубрика вне отраслей): подсказки нет, чем учить мерить не то. */
  it('без вида подсказки ссылки «Как подобрать размер» нет и при выборе размера', async () => {
    const variant = (itemId: string, size: string) => ({
      itemId, price: 2500, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch(cardRules({ ...CARD, variants: [variant('item-1', 'S'), variant('item-2', 'M')] }));

    renderCard();

    expect(await screen.findByText('S', { selector: 'button *, button' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Как подобрать размер' })).not.toBeInTheDocument();
  });

  it('без выбора размера ссылки «Как подобрать размер» нет', async () => {
    stubFetch(cardRules());

    renderCard();

    await screen.findByRole('heading', { name: 'Цемент М400' });
    expect(screen.queryByRole('button', { name: 'Как подобрать размер' })).not.toBeInTheDocument();
  });

  it('единица у цены карточки и похожих — «за коробку», а не «за коробка»', async () => {
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }]),
      get('/api/portal/catalog?', {
        page: 0, size: 5, totalElements: 1, items: [
          { id: 'item-2', name: 'Клей', unit: 'канистра', price: 3100, favorite: false },
        ],
      }),
      ...cardRules({ ...CARD, unit: 'коробка', categoryId: 'cat-1' }),
    ]);

    renderCard();

    expect(await screen.findByTestId('item-price')).toHaveTextContent('за коробку');
    const [similar] = await screen.findAllByTestId('similar-card');
    expect(similar).toHaveTextContent('за канистру');
  });

  it('похожий товар со скидкой и меткой «Новинка» — одной меткой «Акция + новинка»', async () => {
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }]),
      get('/api/portal/catalog?', {
        page: 0, size: 5, totalElements: 3, items: [
          {
            id: 'item-2', name: 'Цемент М500', unit: 'мешок', price: 3100, favorite: false, discountPercent: 10, oldPrice: 3450,
            terms: { hit: false, novelty: true, ageRestricted: false },
          },
          {
            id: 'item-3', name: 'Цемент М600', unit: 'мешок', price: 3500, favorite: false,
            terms: { hit: false, novelty: true, ageRestricted: false },
          },
        ],
      }),
      ...cardRules({ ...CARD, categoryId: 'cat-1' }),
    ]);

    renderCard();

    const similar = await screen.findAllByTestId('similar-card');
    expect(within(similar[0]).getByTestId('promo-badge')).toHaveTextContent(/^Акция \+ новинка$/);
    expect(within(similar[1]).getByTestId('promo-badge')).toHaveTextContent(/^Новинка$/);
  });

  it('у похожего товара одна метка по старшинству, как в макете: акция, новинка, затем «Хит продаж»', async () => {
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }]),
      get('/api/portal/catalog?', {
        page: 0, size: 5, totalElements: 4, items: [
          {
            id: 'item-2', name: 'Цемент М500', unit: 'мешок', price: 3100, favorite: false, discountPercent: 10, oldPrice: 3450,
            terms: { hit: true, novelty: false, ageRestricted: false },
          },
          {
            id: 'item-3', name: 'Цемент М600', unit: 'мешок', price: 3500, favorite: false,
            terms: { hit: true, novelty: true, ageRestricted: false },
          },
          {
            id: 'item-4', name: 'Цемент М700', unit: 'мешок', price: 3900, favorite: false,
            terms: { hit: true, novelty: false, ageRestricted: false },
          },
        ],
      }),
      ...cardRules({ ...CARD, categoryId: 'cat-1' }),
    ]);

    renderCard();

    const similar = await screen.findAllByTestId('similar-card');
    expect(within(similar[0]).getByTestId('promo-badge')).toHaveTextContent(/^Акция$/);
    expect(within(similar[0]).queryByText('Хит продаж')).not.toBeInTheDocument();
    expect(within(similar[1]).getByTestId('promo-badge')).toHaveTextContent(/^Новинка$/);
    expect(within(similar[1]).queryByText('Хит продаж')).not.toBeInTheDocument();
    expect(within(similar[2]).getByTestId('promo-badge')).toHaveTextContent(/^Хит продаж$/);
  });

  it('назад и избранное стоят кружками поверх снимка', async () => {
    stubFetch(cardRules());

    renderCard();

    // «Назад» — кружок на снимке, а не строчка над содержимым: большой палец
    // держит телефон за нижний край, а угол снимка он всё же достаёт.
    expect(await screen.findByRole('button', { name: 'Назад' })).toBeInTheDocument();
    // Сердечко на снимке и кнопка «В избранное» в панели покупки — как в макете.
    expect(screen.getAllByRole('button', { name: 'В избранное' })).toHaveLength(2);
  });

  it('«Назад» карточки, открытой по ссылке, ведёт в каталог', async () => {
    stubFetch(cardRules());
    renderScreen(
      <Routes>
        <Route path="/catalog/:itemId" element={<ItemCardPage />} />
        <Route path="/catalog" element={<h1>Каталог</h1>} />
      </Routes>,
      { route: '/catalog/item-1' },
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Назад' }));
    expect(await screen.findByRole('heading', { name: 'Каталог' })).toBeInTheDocument();
  });

  /**
   * Касание по кадру больше не перелистывает — оно открывает.
   *
   * Кадр в карточке мал, и по нему видно, что снимок есть, но не видно
   * товара. Листают дальше уже во весь экран, вместе с роликами.
   */
  it('касание по кадру открывает снимки во весь экран', async () => {
    stubFetch(cardRules({
      ...CARD,
      media: [
        { id: 'm1', kind: 'PHOTO', source: 'LINK', url: 'https://cdn.example/1.jpg', title: 'Мешок 50 кг', sortOrder: 10 },
        { id: 'm3', kind: 'PHOTO', source: 'LINK', url: 'https://cdn.example/2.jpg', sortOrder: 20 },
      ],
    }));

    renderCard();

    expect(await screen.findByTestId('gallery-photo')).toHaveAttribute('src', 'https://cdn.example/1.jpg');

    await userEvent.click(screen.getByRole('button', { name: 'Открыть снимок' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('img', { name: 'Мешок 50 кг' }))
      .toHaveAttribute('src', 'https://cdn.example/1.jpg');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Следующий кадр' }));
    expect(within(dialog).getByRole('img', { name: 'Цемент М400' }))
      .toHaveAttribute('src', 'https://cdn.example/2.jpg');
  });

  it('сумма стоит рядом с количеством, и кнопка кладёт позицию, даже если счётчика не касались', async () => {
    const { calls } = stubFetch([...rememberingCart(cartWith(1)), ...cardRules()]);

    renderCard();

    // Первым стоит допустимое количество, а не ноль: «Сумма 0 ₸» пришедший
    // за одним мешком прочитал бы как поломку.
    expect(await screen.findByTestId('item-sum')).toHaveTextContent('2 500 ₸');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'PUT');
      expect(sent).toBeDefined();
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 1 });
    });
    // После добавления — «Добавлено» и путь в корзину, как в макете.
    expect(await screen.findByRole('status')).toHaveTextContent('Добавлено в корзину: 1 мешок');
    expect(screen.getByRole('link', { name: 'Перейти в корзину' })).toHaveAttribute('href', '/checkout');
  });

  it('уже набранная позиция правится счётчиком корзины, а сумма считается по нему', async () => {
    stubFetch(cardRules(CARD, [], cartWith(20)));

    renderCard();

    // Цена × количество: человек видит, во что обойдётся набранное.
    await waitFor(() => expect(screen.getByTestId('item-sum')).toHaveTextContent('50 000 ₸'));
    expect(screen.getByLabelText(/^Количество, /)).toHaveValue(20);
    expect(screen.queryByRole('button', { name: 'Добавить в корзину' })).not.toBeInTheDocument();
  });

  it('минимум продавца — первым количеством, метки — на снимке, похожие — из рубрики', async () => {
    const { calls } = stubFetch([
      method('PUT', '/api/portal/cart/lines/item-1', cartWith(15)),
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }]),
      get('/api/portal/catalog?', {
        page: 0, size: 5, totalElements: 2, items: [
          { id: 'item-1', name: 'Цемент М400', unit: 'мешок', price: 2500, favorite: false },
          { id: 'item-2', name: 'Цемент М500', unit: 'мешок', price: 3100, favorite: false, discountPercent: 10, oldPrice: 3450, rating: 4.8, reviewCount: 5 },
        ],
      }),
      ...cardRules({
        ...CARD,
        categoryId: 'cat-1',
        oldPrice: 2800,
        discountPercent: 11,
        terms: { hit: true, novelty: false, ageRestricted: false, minQuantity: 10, quantityStep: 5 },
      }),
    ]);

    renderCard();

    expect(await screen.findByText('Хит продаж')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Где вы находитесь' }))
      .toHaveTextContent('Сухие смеси'));
    expect(screen.getByText('−11%')).toBeInTheDocument();
    expect(screen.getByText('Заказ от 10 мешков')).toBeInTheDocument();
    expect(screen.getByText('Продаём по 5 мешков')).toBeInTheDocument();
    expect(screen.getByTestId('item-sum')).toHaveTextContent('25 000 ₸');

    // Похожие — из той же рубрики, без самой позиции.
    const similar = await screen.findAllByTestId('similar-card');
    expect(similar).toHaveLength(1);
    expect(similar[0]).toHaveTextContent('Цемент М500');
    // В похожих скидка — словом «Акция», как в макете карточки, а не процентом.
    expect(within(similar[0]).getByTestId('promo-badge')).toHaveTextContent('Акция');
    expect(within(similar[0]).queryByText('−10%')).not.toBeInTheDocument();
    // Оценка в похожих — тот же значок, что на плитках витрины: «4,8 (5)».
    expect(within(similar[0]).getByLabelText('Оценка 4,8 из 5, 5 отзывов')).toHaveTextContent('4,8(5)');
    // Кратность 5 уже сказана «Продаём по 5 мешков» — «поштучно» рядом спорило бы с ней.
    expect(screen.queryByText(/^Продаётся (поштучно|в единицах)/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
    expect(screen.getByTestId('item-sum')).toHaveTextContent('37 500 ₸');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));
    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'PUT');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 15 });
    });
  });

  it('вопрос продавцу ведёт в переписку о позиции', async () => {
    stubFetch(cardRules());

    renderCardWithQuestions();

    await userEvent.click(await screen.findByRole('button', { name: 'Спросить продавца' }));

    expect(await screen.findByRole('heading', { name: '/questions?item=item-1' })).toBeInTheDocument();
  });

  it('избранное переключается прямо из карточки', async () => {
    const { calls } = stubFetch([
      ...cardRules(),
      method('POST', '/api/portal/favorites/item-1/toggle', { itemId: 'item-1', favorite: true }),
    ]);

    renderCard();

    const [toggle] = await screen.findAllByRole('button', { name: 'В избранное' });
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/favorites/item-1/toggle'))).toBe(true);
    });
    expect(await screen.findByRole('button', { name: 'Убрать из избранного' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'В избранном' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('состав в процентах — полосками «Из чего сделано», скидки на товар и участие в акции', async () => {
    stubFetch([
      get('/api/portal/promotions', {
        sale: { title: 'Осенняя распродажа', maxPercent: 20, endsOn: '2099-09-30', endsAt: '2099-10-01T00:00:00Z', countdown: true },
        volumeTiers: [{ from: 100000, percent: 5 }],
        firstOrder: { percent: 5, status: 'ELIGIBLE' },
        deals: [], dealCount: 1,
        volumeHintPercent: 100,
      }),
      ...cardRules({
        ...CARD,
        price: 2000, oldPrice: 2500, discountPercent: 20,
        attributes: [{ name: 'Состав', value: 'Вискоза 65%, полиэстер 30%, эластан 5%' }],
      }),
    ]);

    renderCard();

    expect(await screen.findByRole('heading', { name: 'Из чего сделано' })).toBeInTheDocument();
    expect(screen.getByText('Полиэстер')).toBeInTheDocument();
    // Строкой «Состав» он уже не повторяется.
    expect(screen.queryAllByTestId('item-property').some((row) => row.textContent?.startsWith('Состав'))).toBe(false);

    expect(await screen.findByTestId('sale-participation')).toHaveTextContent('Участвует в акции «Осенняя распродажа»');
    const discounts = screen.getByRole('region', { name: 'Скидки на этот товар' });
    expect(within(discounts).getByText('−20%')).toBeInTheDocument();
    expect(within(discounts).getByText('Оптом дешевле')).toBeInTheDocument();
    expect(within(discounts).getByText('Первая заявка')).toBeInTheDocument();
    expect(within(discounts).getByText(/Скидки не складываются/)).toBeInTheDocument();
    // «Сколько добрать» — по порогам акции, даже без подсказки корзины (`nextTier`).
    expect(within(discounts).getByText(/^До оптовой скидки: ещё 100\s000\s₸$/)).toBeInTheDocument();
    // Отсчёт включён продавцом — видны дни, часы и минуты.
    expect(screen.getByTestId('sale-participation')).toHaveTextContent('дн');
  });

  // Распродажи опта и розницы свои: у «только опт» плашка — оптовой акции, а не той, что выбрана в каталоге (2026-11-15).
  it('у товара «только опт» плашка называет оптовую распродажу', async () => {
    const { calls } = stubFetch([
      get('/api/portal/promotions?mode=WHOLESALE',
        { sale: { title: 'Оптовая неделя', maxPercent: 10, endsOn: '2099-11-21', countdown: false }, volumeTiers: [], deals: [], dealCount: 0 }),
      get('/api/portal/promotions',
        { sale: { title: 'Осенняя распродажа', maxPercent: 20, endsOn: '2099-11-30', countdown: false }, volumeTiers: [], deals: [], dealCount: 0 }),
      ...cardRules({
        ...CARD, unit: 'упаковка', price: 1620, oldPrice: 1800, discountPercent: 10,
        terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 1, quantityStep: 1 },
        wholesale: { unit: 'упаковка', pieceUnit: 'мешок', packQty: 20, retail: false, tiers: [{ from: 1, price: 1620, oldPrice: 1800 }] },
      }),
    ]);
    renderCard();

    expect(await screen.findByTestId('sale-participation')).toHaveTextContent('«Оптовая неделя»');
    expect(calls.some((call) => call.url.includes('/api/portal/promotions') && call.url.includes('mode=WHOLESALE'))).toBe(true);
  });

  describe('«Оптом дешевле» в «Скидках на этот товар»', () => {
    const TIERS = [{ from: 50000, percent: 3 }, { from: 100000, percent: 5 }];
    const cartOn = (goodsTotal: number) => ({ ...emptyCart, goodsTotal });

    function discountsWith(promo: Record<string, unknown>, goodsTotal: number) {
      stubFetch([
        get('/api/portal/promotions', { volumeTiers: TIERS, deals: [], dealCount: 0, ...promo }),
        ...cardRules(CARD, [], cartOn(goodsTotal)),
      ]);
      renderCard();
      return screen.findByRole('region', { name: 'Скидки на этот товар' });
    }

    it('строка называет порог, к которому идёт полоса', async () => {
      const discounts = await discountsWith({ volumeHintPercent: 100 }, 10000);

      expect(within(discounts).getByText(/^От 50\s000\s₸ в заявке$/)).toBeInTheDocument();
      expect(within(discounts).getByText('−3%')).toBeInTheDocument();
      expect(within(discounts).getByText(/^До оптовой скидки: ещё 40\s000\s₸$/)).toBeInTheDocument();
    });

    it('взятый порог: «−3% ваша, ещё N до −5%»', async () => {
      const discounts = await discountsWith({ volumeHintPercent: 50 }, 60000);

      expect(within(discounts).getByText(/^−3% ваша, ещё 40\s000\s₸ до −5%$/)).toBeInTheDocument();
    });

    it('без подсказки магазина (volumeHintPercent) полосы «ещё N» нет', async () => {
      const discounts = await discountsWith({}, 10000);

      expect(within(discounts).getByText(/^От 50\s000\s₸ в заявке$/)).toBeInTheDocument();
      expect(within(discounts).queryByText(/До оптовой скидки/)).not.toBeInTheDocument();
    });
  });

  it('метка «Заказывал в магазине» — только у отзыва с заявкой, а чужой отзыв можно отметить полезным', async () => {
    const other = {
      id: 'r9', itemId: 'item-1', authorName: 'Айгерим С.', rating: 5, text: 'Отлично', status: 'PUBLISHED',
      createdAt: '2026-09-14T10:00:00Z', reply: 'Спасибо!', tags: ['GOOD_QUALITY'], helpful: 4, helpfulByMe: false, mine: false,
      verifiedPurchase: true,
    };
    const offline = {
      id: 'r8', itemId: 'item-1', authorName: 'Марат С.', rating: 5, text: 'Брал на складе', status: 'PUBLISHED',
      createdAt: '2026-09-13T10:00:00Z', tags: [], helpful: 0, helpfulByMe: false, mine: false,
      verifiedPurchase: false,
    };
    const { calls } = stubFetch([
      method('POST', '/api/portal/reviews/r9/helpful', { ...other, helpful: 5, helpfulByMe: true }),
      ...cardRules(CARD, [other, offline]),
    ]);

    renderCard();

    const [review, withoutOrder] = await screen.findAllByTestId('review');
    expect(within(review).getByText('✓ Заказывал в магазине')).toBeInTheDocument();
    expect(within(withoutOrder).queryByText('✓ Заказывал в магазине')).not.toBeInTheDocument();
    expect(within(review).getByText('Хорошее качество')).toBeInTheDocument();
    expect(within(review).getByText('Ответ магазина')).toBeInTheDocument();
    expect(screen.getByTestId('reviews-summary')).toHaveTextContent('5,0');

    await userEvent.click(within(review).getByRole('button', { name: 'Полезно · 4' }));
    await waitFor(() => expect(calls.some((call) => call.url.includes('/reviews/r9/helpful'))).toBe(true));
    expect(await within(review).findByRole('button', { name: 'Полезно · 5' })).toHaveAttribute('aria-pressed', 'true');
  });
});

/**
 * Свой отзыв в карточке — по его состоянию модерации. Отклонённый продавцом
 * не «появится после проверки»: проверка прошла, и обещать обратное — значит
 * заставить человека ждать того, что не случится. Как в «Моих отзывах»:
 * пометка на самом отзыве, причина, если продавец её назвал, и правка,
 * которая вернёт отзыв на проверку.
 */
describe('свой отзыв в карточке по состоянию модерации', () => {
  afterEach(() => vi.unstubAllGlobals());

  const MINE = {
    id: 'r1',
    itemId: 'item-1',
    authorName: 'Асхат К.',
    rating: 2,
    text: 'Мешок порван',
    createdAt: '2026-09-01T10:00:00Z',
    tags: [],
    helpful: 0,
    helpfulByMe: false,
    mine: true,
  };

  it('отклонённый показывает пометку, решение продавца с причиной и «Изменить отзыв», а не «после проверки»', async () => {
    stubFetch(cardRules(CARD, [{ ...MINE, status: 'REJECTED', rejectReason: 'OFF_TOPIC' }]));
    renderCard();

    const review = await screen.findByTestId('review');
    expect(within(review).getByText('Не опубликован')).toBeInTheDocument();
    expect(within(review).queryByText('Ждёт проверки продавцом')).not.toBeInTheDocument();

    expect(screen.getByText('Продавец не опубликовал отзыв')).toBeInTheDocument();
    expect(screen.getByText('Причина: Не о товаре')).toBeInTheDocument();
    expect(screen.queryByText(/после проверки/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Спасибо за отзыв!')).not.toBeInTheDocument();

    // Правка возвращает отзыв на проверку — об этом сказано у формы.
    await userEvent.click(screen.getByRole('button', { name: 'Изменить отзыв' }));
    expect(screen.getByText('Исправленный отзыв снова уйдёт на проверку продавцом.')).toBeInTheDocument();
  });

  it('отклонённый без причины причину не выдумывает', async () => {
    stubFetch(cardRules(CARD, [{ ...MINE, status: 'REJECTED' }]));
    renderCard();

    expect(await screen.findByText('Продавец не опубликовал отзыв')).toBeInTheDocument();
    expect(screen.queryByText(/^Причина:/)).not.toBeInTheDocument();
  });

  it('ждущий проверки — как раньше: «появится после проверки» и пометка «Ждёт проверки»', async () => {
    stubFetch(cardRules(CARD, [{ ...MINE, status: 'PENDING' }]));
    renderCard();

    const review = await screen.findByTestId('review');
    expect(within(review).getByText('Ждёт проверки продавцом')).toBeInTheDocument();
    expect(within(review).queryByText('Не опубликован')).not.toBeInTheDocument();
    expect(screen.getByText('Спасибо за отзыв!')).toBeInTheDocument();
    expect(screen.getByText(/после проверки продавцом/)).toBeInTheDocument();
    expect(screen.queryByText('Продавец не опубликовал отзыв')).not.toBeInTheDocument();
  });

  it('опубликованный — как раньше: «уже в списке», без пометок', async () => {
    stubFetch(cardRules(CARD, [{ ...MINE, status: 'PUBLISHED' }]));
    renderCard();

    const review = await screen.findByTestId('review');
    expect(within(review).queryByText('Ждёт проверки продавцом')).not.toBeInTheDocument();
    expect(within(review).queryByText('Не опубликован')).not.toBeInTheDocument();
    expect(screen.getByText('Спасибо за отзыв!')).toBeInTheDocument();
    expect(screen.getByText(/Он уже в списке/)).toBeInTheDocument();
    expect(screen.queryByText('Продавец не опубликовал отзыв')).not.toBeInTheDocument();
  });
});

/** Как получить — одной строкой-справкой, без адресов и цен (просьба владельца 2026-11-14). */
describe('доставка и самовывоз в карточке товара', () => {
  afterEach(() => vi.unstubAllGlobals());

  const method = (pickup: boolean) => ({ id: pickup ? 'p' : 'd', name: pickup ? 'Самовывоз' : 'До двери', pickup,
    requiresAddress: !pickup, requiresFloor: false, requiresTimeSlot: false, price: 1500, freeFromAmount: 50000,
    negotiable: false, zones: [], slots: [], carriers: [] });

  it('возит и есть точка самовывоза — «Есть доставка и самовывоз», без адреса и цены', async () => {
    stubFetch([
      get('/api/portal/delivery', { mode: 'ENABLED', methods: [method(false)],
        pickupPoints: [{ id: 'p1', name: 'Склад', address: 'ул. Рыскулова 101', workingHours: 'до 18:00' }] }),
      ...cardRules(),
    ]);
    renderCard();

    expect(await screen.findByTestId('deal-way')).toHaveTextContent('Есть доставка и самовывоз');
    expect(screen.getByTestId('deal-way')).toHaveAttribute('href', '/delivery');
    expect(screen.queryByText(/Рыскулова/)).not.toBeInTheDocument();
    expect(screen.queryByText(/50 000/)).not.toBeInTheDocument();
  });

  it('только самовывоз', async () => {
    stubFetch([
      get('/api/portal/delivery', { mode: 'PICKUP_ONLY', methods: [], pickupPoints: [] }),
      ...cardRules(),
    ]);
    renderCard();

    expect(await screen.findByTestId('deal-way')).toHaveTextContent('Только самовывоз');
  });

  it('только доставка', async () => {
    stubFetch([
      get('/api/portal/delivery', { mode: 'ENABLED', methods: [method(false)], pickupPoints: [] }),
      ...cardRules(),
    ]);
    renderCard();

    expect(await screen.findByTestId('deal-way')).toHaveTextContent('Есть доставка');
  });
});
