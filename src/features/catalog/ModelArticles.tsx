import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShowcaseCardDto } from '../../api/generated';
import { cn } from '../../ui/cn';
import { axesOf, valuesOf } from './VariantPicker';

const SHOWN = 3;

/** Артикулы цветов модели по порядку цветов, открытый — первым; без повторов и пустых. */
export function modelArticles(item: ShowcaseCardDto): string[] {
  const variants = item.variants ?? [];
  const colour = axesOf(variants).find((axis) => axis.colour);
  const ordered = colour
    ? colour.options.map((option) => variants.find((variant) => valuesOf(variant).get(colour.code)?.text === option && variant.article)?.article)
    : variants.map((variant) => variant.article);
  const all = [item.article, ...ordered].filter((article): article is string => !!article);
  return [...new Set(all)];
}

/**
 * «Арт. AZA01-BL, AZA01-BR, AZA01-M» — артикулы всех цветов модели под названием, как у Спортмастера
 * (решение владельца 2026-11-14: артикулы цветов, не размеров). Открытый цвет — первым и жирнее;
 * больше трёх — «Показать все».
 */
export function ModelArticles({ item }: { item: ShowcaseCardDto }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const articles = modelArticles(item);
  if (articles.length === 0) return null;
  const shown = open ? articles : articles.slice(0, SHOWN);
  return (
    <p data-testid="model-articles" className="m-0 text-sm text-ink-subtle">
      {t('item.articles')}{' '}
      {shown.map((article, index) => (
        <span key={article}>
          {index > 0 ? ', ' : ''}
          {/* Код не рвётся на дефисе: «LOW-ELE-» на одной строке и «BEG» на другой читались двумя артикулами (QA 360px). */}
          <span className={cn('whitespace-nowrap', article === item.article && 'font-semibold text-ink-muted')}>{article}</span>
        </span>
      ))}
      {articles.length > SHOWN ? (
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}
          className="ml-1.5 rounded-[4px] font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {open ? t('item.articlesLess') : t('item.articlesMore', { count: articles.length })}
        </button>
      ) : null}
    </p>
  );
}
