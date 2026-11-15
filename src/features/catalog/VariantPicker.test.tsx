import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import '../../i18n';
import type { ShowcaseVariantDto } from '../../api/generated';
import { VariantPicker, axesOf } from './VariantPicker';

function variant(itemId: string, size: string, colour?: string, composition = 'Хлопок 100%'): ShowcaseVariantDto {
  return {
    itemId,
    price: 29990,
    fields: [
      { code: 'SIZE', name: 'Размер', type: 'TEXT', value: size },
      ...(colour ? [{ code: 'COLOR', name: 'Цвет', type: 'TEXT' as const, value: colour }] : []),
      { code: 'COMPOSITION', name: 'Состав', type: 'TEXT', value: composition },
    ],
  } as ShowcaseVariantDto;
}

function Opened() {
  const { itemId } = useParams();
  return <span data-testid="opened">{itemId}</span>;
}

function renderPicker(itemId: string, variants: ShowcaseVariantDto[]) {
  render(
    <MemoryRouter initialEntries={[`/catalog/${itemId}`]}>
      <Routes>
        <Route path="/catalog/:itemId" element={<><VariantPicker itemId={itemId} variants={variants} /><Opened /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Выбор варианта товара', () => {
  it('выбирает только из различающихся полей, цвет первым', () => {
    const axes = axesOf([variant('a', 'S', 'Чёрный'), variant('b', 'M', 'Чёрный'), variant('c', 'S', 'Бежевый')]);
    expect(axes.map((axis) => axis.name)).toEqual(['Цвет', 'Размер']);
    expect(axes[1].options).toEqual(['S', 'M']);
  });

  it('размер плашками: выбранный отмечен, другой открывает свою позицию', async () => {
    renderPicker('a', [variant('a', 'S'), variant('b', 'M'), variant('c', 'L')]);

    expect(screen.getByText('Размер:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'S' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'M' }));
    expect(screen.getByTestId('opened')).toHaveTextContent('b');
  });

  it('цвет кружком по цвету продавца — и для названия, которого нет в таблице («Изумрудный»)', () => {
    const coloured = (itemId: string, name: string, hex?: string) => ({
      itemId, price: 7200,
      fields: [{ code: 'COLOUR', name: 'Цвет', type: 'OPTION', value: name, ...(hex ? { hex } : {}) }],
    }) as ShowcaseVariantDto;
    renderPicker('a', [coloured('a', 'Бежевый'), coloured('b', 'Изумрудный', '#2E8B6E')]);

    expect(screen.getByRole('button', { name: 'Цвет: Изумрудный' })).toHaveStyle({ background: '#2E8B6E' });
    // Без цвета продавца — по названию, как раньше.
    expect(screen.getByRole('button', { name: 'Цвет: Бежевый' })).toHaveStyle({ background: '#D8CFC2' });
  });

  it('цвет кружками и смена цвета сохраняет размер', async () => {
    renderPicker('a', [
      variant('a', 'M', 'Чёрный'), variant('b', 'L', 'Чёрный'),
      variant('c', 'S', 'Бежевый'), variant('d', 'M', 'Бежевый'),
    ]);

    const beige = screen.getByRole('button', { name: 'Цвет: Бежевый' });
    expect(beige).toHaveStyle({ background: '#D8CFC2' });
    await userEvent.click(beige);
    expect(screen.getByTestId('opened')).toHaveTextContent('d');
  });
});

describe('цвет и системы размеров', () => {
  const photo = (url: string) => [{ id: url, kind: 'PHOTO', source: 'UPLOAD', url, sortOrder: 0 }] as never;

  it('цвет выбирают цветом, а не снимком — даже когда фото есть у каждого цвета', () => {
    renderPicker('a', [
      { ...variant('a', '48', 'Болотный'), media: photo('/green.jpg') },
      { ...variant('b', '48', 'Молочный'), media: photo('/white.jpg') },
    ]);
    const swamp = screen.getByRole('button', { name: /Болотный/ });
    expect(swamp.querySelector('img')).toBeNull();
    expect(swamp).toHaveAttribute('aria-pressed', 'true');
  });

  it('размер в рознице — строкой таблицы RUS | INT, без переключателя систем', async () => {
    const chart = { sizes: [{ code: 'RU48', label: '48', intl: 'M' }, { code: 'RU50', label: '50', intl: 'L' }], rows: [] } as never;
    render(
      <MemoryRouter initialEntries={['/catalog/a']}>
        <Routes>
          <Route path="/catalog/:itemId" element={<><VariantPicker itemId="a" variants={[variant('a', '48'), variant('b', '50')]} chart={chart} /><Opened /></>} />
        </Routes>
      </MemoryRouter>,
    );
    const rows = screen.getByTestId('size-rows');
    expect(within(rows).getByRole('radio', { checked: true })).toHaveTextContent('48M');
    expect(within(rows).getByRole('radio', { name: /50 · L/ })).toHaveTextContent('50L');
    expect(screen.queryByRole('radio', { name: 'INT' })).not.toBeInTheDocument();
    await userEvent.click(within(rows).getByRole('radio', { name: /50 · L/ }));
    expect(screen.getByTestId('opened')).toHaveTextContent('b');
  });

  it('размер без остатка помечен и в плашках, и в таблице, но выбирается — там «Сообщить о поступлении»', async () => {
    const out = { ...variant('b', '50'), stock: 'OUT_OF_STOCK' } as ShowcaseVariantDto;
    renderPicker('a', [variant('a', '48'), out]);
    const plate = screen.getByRole('button', { name: 'Размер: 50, нет в наличии' });
    expect(plate).toHaveClass('line-through');
    expect(screen.getByRole('button', { name: '48' })).not.toHaveClass('line-through');
    await userEvent.click(plate);
    expect(screen.getByTestId('opened')).toHaveTextContent('b');

    const chart = { sizes: [{ code: 'RU48', label: '48', intl: 'M' }, { code: 'RU50', label: '50', intl: 'L' }], rows: [] } as never;
    render(
      <MemoryRouter initialEntries={['/catalog/a']}>
        <Routes><Route path="/catalog/:itemId" element={<VariantPicker itemId="a" variants={[variant('a', '48'), out]} chart={chart} />} /></Routes>
      </MemoryRouter>,
    );
    expect(within(screen.getByTestId('size-rows')).getByRole('radio', { name: /50 · L, нет в наличии/ })).toHaveTextContent('нет в наличии');
  });
});
