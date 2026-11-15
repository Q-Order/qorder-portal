import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { TemplatePrice } from './TemplatePrice';
import { renderScreen } from '../../../test/render';

describe('цена в плитке шаблона', () => {
  it('цена по условию клиента — «ваша цена», цена каталога зачёркнута, подсказки опта нет', () => {
    renderScreen(
      <TemplatePrice
        item={{
          price: 900, oldPrice: 1000, unit: 'мешок', yourPrice: true,
          wholesale: { unit: 'упаковка', packQty: 20, pieceUnit: 'мешок', retail: true, tiers: [{ from: 1, price: 1800 }] },
        }}
        look="plain"
      />,
    );

    expect(screen.getByTestId('your-price')).toHaveTextContent('ваша цена');
    expect(screen.getByText(/1\s?000/, { selector: 's' })).toBeInTheDocument();
    expect(screen.queryByText(/Опт/)).not.toBeInTheDocument();
  });

  it('единица после «за» — «за бутылку», «за шт.»', () => {
    renderScreen(
      <>
        <TemplatePrice item={{ price: 900, unit: 'бутылка' }} look="plain" />
        <TemplatePrice item={{ price: 100, unit: 'шт' }} look="plain" />
      </>,
    );

    expect(screen.getByText('за бутылку')).toBeInTheDocument();
    expect(screen.getByText('за шт.')).toBeInTheDocument();
  });

  it('товар «оба режима» — цена упаковки на лучшей ступени с «от» и вложение в скобках, розница подписана', () => {
    renderScreen(
      <TemplatePrice
        item={{
          price: 100, unit: 'мешок',
          wholesale: { unit: 'упаковка', packQty: 20, pieceUnit: 'мешок', retail: true,
            tiers: [{ from: 1, price: 1800 }, { from: 10, price: 1700 }] },
        }}
        look="plain"
      />,
    );

    // Строки «Оптом: …» в каталоге нет (2026-11-15): цены опта — в карточке.
    expect(screen.queryByTestId('wholesale-note')).not.toBeInTheDocument();
    expect(screen.getByText('в розницу за мешок')).toBeInTheDocument();
  });

  it('поштучный опт — порог вместо «упаковка (1 шт.)»', () => {
    renderScreen(
      <TemplatePrice
        item={{
          price: 31990, unit: 'шт',
          wholesale: { unit: 'шт', packQty: 1, pieceUnit: 'шт.', retail: true, tiers: [{ from: 20, price: 24000 }] },
        }}
        look="plain"
      />,
    );

    expect(screen.queryByTestId('wholesale-note')).not.toBeInTheDocument();
  });

  it('товар «только опт» — цена без «за упаковку» и вложения', () => {
    renderScreen(
      <TemplatePrice
        item={{
          price: 1800, unit: 'упаковка',
          wholesale: { unit: 'упаковка', packQty: 20, pieceUnit: 'мешок', retail: false,
            tiers: [{ from: 1, price: 1800 }] },
        }}
        look="plain"
      />,
    );

    // В каталоге у «только опт» — одна цена: без «за упаковку» и вложения (2026-11-15).
    expect(screen.queryByTestId('wholesale-note')).not.toBeInTheDocument();
    expect(screen.queryByText(/за упаковку|20 мешков/)).not.toBeInTheDocument();
    expect(screen.getByText(/1\s800/)).toHaveClass('text-ok-ink');
  });

  it('у штучного товара подписи опта нет', () => {
    renderScreen(<TemplatePrice item={{ price: 100, unit: 'мешок' }} look="plain" />);
    expect(screen.queryByTestId('wholesale-note')).not.toBeInTheDocument();
  });
});
