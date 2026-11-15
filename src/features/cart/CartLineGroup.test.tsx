import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { CartLineDto } from '../../api/generated';
import { LineGroupRow, LineGroupSummary } from './CartLineGroup';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';
import userEvent from '@testing-library/user-event';
import { SkippedNotice } from './CartLines';
import { LineQuantity } from './LineQuantity';

const LINE = {
  key: 'aza01|black', lines: 2, pieces: 3, linePrice: 30000, piecePrice: 10000,
  sizes: [{ itemId: 'a', label: '48', quantity: 2 }, { itemId: 'b', label: '50', quantity: 4 }],
};
const size = (itemId: string, label: string, quantity: number) => ({
  itemId, name: 'Куртка AZA01', variantLabel: `Чёрный · ${label}`, quantity, unit: 'шт', total: quantity * 10000,
  mode: 'WHOLESALE', line: LINE,
}) as unknown as CartLineDto;

describe('линейка в сводке оформления', () => {
  it('одна строка: ряд размеров, цвет без размера, число линеек, штуки по цене штуки и сумма всех размеров', () => {
    render(<LineGroupSummary currency="KZT" rows={[size('a', '48', 2), size('b', '50', 4)]} />);
    const row = screen.getByTestId('cart-line');
    expect(row).toHaveTextContent('Куртка AZA01 · линейка 48–50');
    expect(row).toHaveTextContent('Чёрный');
    expect(row).not.toHaveTextContent('Чёрный · 48');
    expect(row).toHaveTextContent(/2 линейки · 6 шт по 10\s000/);
    expect(screen.getByTestId('line-total')).toHaveTextContent(/60\s000/);
  });
});

describe('линейка в корзине', () => {
  it('«+» выключен, когда в корзине уже все полные линейки, что есть в наличии', async () => {
    const row = (lines: number, availableLines: number) => ({
      ...size('a', '48', lines), quantity: lines, line: { ...LINE, lines, availableLines },
    }) as unknown as CartLineDto;
    for (const [lines, available, off] of [[2, 2, true], [2, 3, false]] as const) {
      const cart = { lines: [row(lines, available)], total: 0, skipped: [] };
      stubFetch([get('/api/portal/cart', cart)]);
      const { unmount } = renderScreen(
        <LineGroupRow rows={[row(lines, available)]} currency="KZT" picked onPick={() => {}} onRemove={() => {}} removing={false} />,
      );
      const plus = await screen.findByRole('button', { name: 'Ещё линейку' });
      await waitFor(() => expect(screen.getByTestId('line-quantity')).toHaveTextContent(String(lines)));
      if (off) expect(plus).toBeDisabled(); else expect(plus).toBeEnabled();
      unmount();
    }
  });

  it('счётчик без своего предела (плитка каталога) берёт остаток линеек из корзины', async () => {
    const row = { ...size('a', '48', 2), quantity: 2, line: { ...LINE, lines: 2, availableLines: 2 } } as unknown as CartLineDto;
    stubFetch([get('/api/portal/cart', { lines: [row], total: 0, skipped: [] })]);
    renderScreen(<LineQuantity itemId="b" />);
    await waitFor(() => expect(screen.getByTestId('line-quantity')).toHaveTextContent('2'));
    expect(screen.getByRole('button', { name: 'Ещё линейку' })).toBeDisabled();
  });
});

describe('не вошедшая линейка', () => {
  it('«Взять 1 линейку» кладёт столько полных линеек, сколько есть', async () => {
    const skipped = [{ itemId: 'a', name: 'Куртка AZA01', reason: 'Полных линеек в наличии — 1', takeLines: 1 },
      { itemId: 'x', name: 'Пиджак', reason: 'Позиция больше недоступна' }];
    const { calls } = stubFetch([method('PUT', '/api/portal/cart/wholesale-lines/a', { lines: [], total: 0, skipped: [] })]);
    renderScreen(<SkippedNotice skipped={skipped} />);
    // Кнопка — только у линейки, у снятой с продажи позиции её нет.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Взять 1 линейку' }));
    await waitFor(() => expect(calls.some((call) => call.url.includes('/wholesale-lines/a'))).toBe(true));
    const sent = calls.find((call) => call.url.includes('/wholesale-lines/a'))!;
    expect(JSON.parse(String(sent.init?.body))).toEqual({ lines: 1 });
  });
});
