import { useTranslation } from 'react-i18next';
import type { CartDto } from '../../api/generated';

/**
 * «В заявке есть товары 21+» — рядом с кнопкой оформления.
 *
 * Возраст уже подтверждён при добавлении, а здесь — о другом: при получении
 * продавец попросит удостоверение, и узнать об этом у прилавка поздно.
 */
export function AdultNotice({ cart }: { cart: CartDto | undefined }) {
  const { t } = useTranslation();
  // Возраст — наибольший среди товаров заявки: «есть товары 21+», даже если рядом 18+.
  const age = Math.max(0, ...(cart?.lines ?? []).filter((line) => line.terms?.ageRestricted).map((line) => line.terms?.minAge ?? 21));
  if (age === 0) return null;
  return (
    <p
      role="note"
      className="flex gap-2.5 rounded-[var(--radius-tile)] border border-adult/25 bg-adult/5 p-3 text-caption font-semibold leading-[1.45] text-adult"
    >
      <span aria-hidden="true" className="shrink-0 font-extrabold">{age}+</span>
      {t('cart.adult', { age })}
    </p>
  );
}
