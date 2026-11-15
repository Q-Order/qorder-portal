import { describe, expect, it } from 'vitest';
import { isDelivery } from './DeliveryBlock';

describe('что показывать под «Доставка»', () => {
  it('способ доставки — да; самовывоз и способ доставки с названием «Самовывоз» — нет', () => {
    expect(isDelivery({ pickup: false, name: 'Доставка через курьера' })).toBe(true);
    expect(isDelivery({ pickup: true, name: 'Склад' })).toBe(false);
    expect(isDelivery({ pickup: false, name: 'Самовывоз' })).toBe(false);
    expect(isDelivery({ pickup: false, name: 'Өзі алып кету' })).toBe(false);
  });
});
