import { describe, expect, it } from 'vitest';
import { countryOptions, groupPlus7, phoneFromBook, takePlus7 } from './phone';

describe('phoneFromBook', () => {
  it('номер из книги — цифрами с кодом страны, как бы он ни был записан', () => {
    expect(phoneFromBook('+7 701 000-01-02')).toBe('77010000102');
    expect(phoneFromBook('8 (701) 000 01 02')).toBe('77010000102');
    expect(phoneFromBook('701 000 01 02')).toBe('77010000102');
    expect(phoneFromBook('+996 555 12 34 56')).toBe('996555123456');
    expect(phoneFromBook('00998 90 123 45 67')).toBe('998901234567');
  });
});

describe('только +7 — как на странице входа', () => {
  it('«8» первой цифрой при наборе не принимается, с подсказкой', () => {
    expect(takePlus7('8', false)).toEqual({ digits: '', note: 'eight' });
    expect(takePlus7('8701', false)).toEqual({ digits: '701', note: 'eight' });
  });

  it('лишняя цифра при наборе срезается в конце, а не в начале', () => {
    expect(takePlus7('70112345679', false).digits).toBe('7011234567');
    expect(takePlus7('77712345678', false).digits).toBe('7771234567');
  });

  it('вставка «+7 (701) …» и «8 (701) …» — десять цифр без подсказки', () => {
    expect(takePlus7('+7 (701) 123-45-67', true)).toEqual({ digits: '7011234567', note: null });
    expect(takePlus7('8 (701) 123-45-67', true)).toEqual({ digits: '7011234567', note: null });
    expect(takePlus7('77011234567', true)).toEqual({ digits: '7011234567', note: null });
  });

  it('чужой код с плюсом — отказ', () => {
    expect(takePlus7('+996 555 123 456', true)).toEqual({ digits: '', note: 'foreign' });
  });

  it('группы «701 123 45 67»', () => {
    expect(groupPlus7('7011234567')).toBe('701 123 45 67');
  });

  it('номер на 8 (800, 812) правится как обычно: «без 8» — только для 8, поставленной в начало', () => {
    expect(takePlus7('800555353', false, '8005553535')).toEqual({ digits: '800555353', note: null });
    expect(takePlus7('8121234567', false, '812123456')).toEqual({ digits: '8121234567', note: null });
    expect(takePlus7('8701', false, '701')).toEqual({ digits: '701', note: 'eight' });
    // Стёрли первую цифру «981…» — соседняя «8» остаётся, подсказки нет.
    expect(takePlus7('81123456', false, '981123456', false)).toEqual({ digits: '81123456', note: null });
    // Выделили номер на 8 целиком и набрали «8» — снова местная восьмёрка.
    expect(takePlus7('8', false, '8121234567')).toEqual({ digits: '', note: 'eight' });
  });

  it('набранный «+»: ждём 7; «+7…» — свой код, «8» после него — часть номера', () => {
    expect(takePlus7('+', false)).toEqual({ digits: '', note: null, pending: '+' });
    expect(takePlus7('+9', false)).toEqual({ digits: '', note: 'foreign', pending: '+' });
    // «+7» остаётся в поле до первой цифры — тогда «8» после него часть номера.
    expect(takePlus7('+7', false)).toEqual({ digits: '', note: null, pending: '+7' });
    expect(takePlus7('+78', false)).toEqual({ digits: '8', note: null });
    expect(takePlus7('+77011234567', false)).toEqual({ digits: '7011234567', note: null });
    expect(takePlus7('+7 812 123 45 67', true)).toEqual({ digits: '8121234567', note: null });
  });

  it('вставка 12 цифр без плюса — чужой номер, отказ, а не обрезка', () => {
    expect(takePlus7('996555123456', true)).toEqual({ digits: '', note: 'foreign' });
    expect(takePlus7('8 800 555 35 35', true)).toEqual({ digits: '8005553535', note: null });
  });

  it('в выборе страны только +7', () => {
    expect(countryOptions('ru').map((c) => c.code)).toEqual(['7', '7']);
  });
});
