import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SnapshotLineDto } from '../../api/generated';
import { OrderLineGroup, lineTitle, orderRows } from './OrderLineGroup';
import { OrderLink } from './OrderRow';
import { renderScreen } from '../../test/render';
import type { PortalOrderDto } from '../../api/generated';

const size = (variantLabel: string, patch: Partial<SnapshotLineDto> = {}) =>
  ({ name: 'Куртка AZA01', variantLabel, quantity: 2, unit: 'шт', price: 10000, amount: 20000, lineKey: 'aza01|black', lines: 2, ...patch }) as SnapshotLineDto;

describe('линейка в заявке', () => {
  it('размеры одной линейки — одна строка, прочие строки на своих местах', () => {
    const rows = orderRows([size('Чёрный · 48'), { name: 'Брюки', quantity: 1 } as SnapshotLineDto, size('Чёрный · 50')]);
    expect(rows.map((row) => row.kind)).toEqual(['line', 'one']);
  });

  it('у строк линейки имя одно — название из имени и общей части подписи, размер — из своей', () => {
    expect(lineTitle([size('Чёрный · 48'), size('Чёрный · 50')])).toEqual({ title: 'Куртка AZA01 · Чёрный', labels: ['48', '50'] });
    // Продавец заменил 56 чёрный на мокко — цвет уходит из названия в подписи размеров.
    expect(lineTitle([size('Чёрный · 54'), size('Мокко · 56')])).toEqual({ title: 'Куртка AZA01', labels: ['Чёрный · 54', 'Мокко · 56'] });
    // Заявка до подписи варианта — размер не узнать, остаётся имя.
    expect(lineTitle([{ name: 'Пиджак', quantity: 1 } as SnapshotLineDto, { name: 'Пиджак', quantity: 1 } as SnapshotLineDto]))
      .toEqual({ title: 'Пиджак', labels: ['Пиджак', 'Пиджак'] });
  });

  it('строка: число линеек, штуки по цене штуки, сумма; «линейка изменена» после правки продавца', () => {
    render(
      <MemoryRouter>
        <ul>
          <OrderLineGroup currency="KZT" rows={[size('Чёрный · 54'), size('Мокко · 56', { lineChanged: true })]} />
        </ul>
      </MemoryRouter>,
    );
    const row = screen.getByTestId('order-line');
    expect(row).toHaveTextContent('Куртка AZA01 · 2 линейки');
    expect(row).toHaveTextContent(/4 шт × 10\s000/);
    expect(row).toHaveTextContent(/40\s000/);
    expect(within(row).getByTestId('order-line-changed')).toHaveTextContent('линейка изменена');
  });
});

describe('линейка в счётчиках заявки', () => {
  it('карточка заявки на телефоне: шесть размеров одной линейки и брюки — «2 товара»', () => {
    const lines = [...['48', '50', '52', '54', '56', '58'].map((label) => size(`Чёрный · ${label}`, { quantity: 1, lines: 1 })),
      { name: 'Брюки', quantity: 1, unit: 'шт', price: 5000, amount: 5000 } as SnapshotLineDto];
    const order = { id: 'o-1', orderNumber: '1051', state: 'AWAITING_CONFIRMATION', needsAnswer: true, cancellable: true,
      createdAt: '2026-11-15T06:00:00Z', total: 65000, currency: 'KZT', submitted: lines, proposed: lines, diff: [],
      invoiceAvailable: false, messages: [] } as unknown as PortalOrderDto;
    renderScreen(<OrderLink order={order} />);
    expect(screen.getByTestId('order-row')).toHaveTextContent(/№1051 · .* · 2 товара/);
  });
});
