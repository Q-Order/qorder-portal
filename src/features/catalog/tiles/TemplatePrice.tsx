import { useTranslation } from 'react-i18next';
import type { ShowcaseItemDto } from '../../../api/generated';
import type { PriceLook } from '../../../supplier/templateLook';
import { priceClass } from '../../../supplier/templateLook';
import { money } from '../../../shared/format';
import { useSupplierCurrency } from '../../../supplier/SupplierCurrency';
import { cn } from '../../../ui/cn';
import { perUnitNote } from '../itemParts';

/** Кегль цены в плитке шаблона: как в макете — 16, 18, 20 и 22 точки. */
const SIZES = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-title',
} as const;

/**
 * Цена в характере шаблона: крупной цифрой, ценником второго цвета или
 * моноширинно (`priceClass`). Старая цена — зачёркнутой рядом, единица —
 * мелко: «за мешок» читается раньше, чем человек умножит не на то.
 */
export function TemplatePrice({
  item,
  look,
  size = 'md',
  onImage = false,
  unit = true,
  className,
}: {
  item: Pick<ShowcaseItemDto, 'price' | 'oldPrice' | 'unit' | 'wholesale'> & Partial<Pick<ShowcaseItemDto, 'yourPrice'>>;
  look: PriceLook;
  size?: keyof typeof SIZES;
  /** Поверх снимка: цифры белые, старая цена — светлая. */
  onImage?: boolean;
  /** Подпись «за шт» рядом; в тесной строке с кнопкой её можно убрать. */
  unit?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const sale = item.oldPrice !== undefined;
  return (
    <span className={cn('flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5', className)}>
      <b className={cn('whitespace-nowrap font-extrabold tabular-nums', SIZES[size], priceClass(look, sale, onImage),
        // Все цены зелёные, не только со скидкой (просьба владельца 2026-11-15); старая — зачёркнута красной линией.
        !onImage && 'text-ok-ink')}>
        {money(item.price, currency)}
      </b>
      {sale && (
        <s className={cn('whitespace-nowrap text-xs font-medium tabular-nums decoration-sale decoration-2', onImage ? 'text-white/70' : 'text-ink-muted')}>
          {money(item.oldPrice!, currency)}
        </s>
      )}
      {unit && (
        <span className={cn('whitespace-nowrap text-xs font-semibold', onImage ? 'text-white/80' : 'text-ink-muted')}>
          {perUnitNote(item, t)}
        </span>
      )}
      {item.yourPrice ? (
        <span data-testid="your-price" className={cn('whitespace-nowrap text-xs font-bold', onImage ? 'text-white' : 'text-accent')}>
          {t('catalog.yourPrice')}
        </span>
      ) : null}
    </span>
  );
}
