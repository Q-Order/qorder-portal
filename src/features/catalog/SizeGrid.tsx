import type { ShowcaseVariantDto } from '../../api/generated';
import { axesOf, valuesOf } from './VariantPicker';

const SIZE = /размер|өлшем|size/i;

/** Размеры того же цвета (и прочих полей), что у открытой позиции, — в порядке оси размера. */
export function sizeRowsOf(variants: ShowcaseVariantDto[], current: ShowcaseVariantDto): { size: string; variant: ShowcaseVariantDto }[] {
  const axes = axesOf(variants);
  const size = axes.find((axis) => SIZE.test(axis.name) || SIZE.test(axis.code));
  if (!size) return [];
  const mine = valuesOf(current);
  const others = axes.filter((axis) => axis.code !== size.code);
  return size.options.flatMap((option) => {
    const variant = variants.find((candidate) => {
      const values = valuesOf(candidate);
      return values.get(size.code)?.text === option
        && others.every((axis) => values.get(axis.code)?.text === mine.get(axis.code)?.text);
    });
    return variant ? [{ size: option, variant }] : [];
  });
}
