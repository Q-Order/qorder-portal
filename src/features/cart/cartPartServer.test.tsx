import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';
import { useCartPart } from './cartPart';

const line = (itemId: string, mode: 'RETAIL' | 'WHOLESALE', total: number) => ({
  itemId, name: itemId, quantity: 1, unit: 'шт', priceAtAdding: total, price: total, priceChanged: false, total, mode,
});

function Total() {
  const { cart } = useCartPart();
  return <p data-testid="total">{cart ? `${cart.total}/${cart.discount?.percent ?? '-'}` : ''}</p>;
}

describe('корзина одной заявки', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('в корзине обоих видов итог заявки — с сервера, со своей скидкой', async () => {
    const full = { lines: [line('belt', 'RETAIL', 38400), line('socks', 'WHOLESALE', 120000)], total: 158400, goodsTotal: 158400, skipped: [] };
    const retail = { lines: [full.lines[0]], total: 36480, goodsTotal: 38400, skipped: [],
      discount: { kind: 'FIRST_ORDER', percent: 5, amount: 1920 } };
    const { calls } = stubFetch([
      get('/api/portal/cart/part', retail),
      get('/api/portal/cart', full),
    ]);
    renderScreen(<Total />);

    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('36480/5'));
    expect(calls.some((call) => call.url.includes('/api/portal/cart/part?mode=RETAIL'))).toBe(true);
  });

  it('корзина одного вида и всё отмечено — как есть, без лишнего запроса', async () => {
    const full = { lines: [line('belt', 'RETAIL', 38400)], total: 36480, goodsTotal: 38400, skipped: [],
      discount: { kind: 'FIRST_ORDER', percent: 5, amount: 1920 } };
    const { calls } = stubFetch([get('/api/portal/cart', full)]);
    renderScreen(<Total />);

    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('36480/5'));
    expect(calls.some((call) => call.url.includes('/cart/part'))).toBe(false);
  });
});
