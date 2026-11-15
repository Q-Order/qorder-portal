import { describe, expect, it } from 'vitest';
import type { ShowcaseCardDto, ShowcaseVariantDto } from '../../api/generated';
import { colourMedia } from './ItemCardPage';

const photo = (url: string) => [{ id: url, kind: 'PHOTO', source: 'UPLOAD', url, sortOrder: 0 }] as never;
const variant = (itemId: string, size: string, colour: string, media?: string): ShowcaseVariantDto => ({
  itemId, price: 100,
  fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }, { code: 'COLOR', name: 'Цвет', type: 'TEXT', value: colour }],
  ...(media ? { media: photo(media) } : {}),
}) as ShowcaseVariantDto;

describe('снимки карточки — цвета, а не размера', () => {
  const variants = [variant('s', 'S', 'Синий', '/blue-s.jpg'), variant('m', 'M', 'Синий', '/blue-m.jpg'), variant('r', 'S', 'Красный', '/red.jpg')];

  it('у любого размера одного цвета — те же фото', () => {
    const card = (id: string) => ({ id, media: photo(`/${id}.jpg`), variants }) as unknown as ShowcaseCardDto;
    expect(colourMedia(card('m'))).toEqual(photo('/blue-s.jpg'));
    expect(colourMedia(card('s'))).toEqual(photo('/blue-s.jpg'));
  });

  it('другой цвет — свои фото', () => {
    expect(colourMedia({ id: 'r', media: [], variants } as unknown as ShowcaseCardDto)).toEqual(photo('/red.jpg'));
  });
});
