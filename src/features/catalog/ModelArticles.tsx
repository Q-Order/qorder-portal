import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ShowcaseCardDto } from '../../api/generated';
import { axesOf, pickVariant, valuesOf } from './VariantPicker';

const SHOWN = 3;

/**
 * Артикулы цветов модели по порядку цветов, открытый — первым; без повторов и пустых.
 * У каждого — позиция, куда ведёт ссылка: тот же цвет с размером, как у открытой, — как нажатие на кружок цвета.
 */
export function modelArticles(item: ShowcaseCardDto): { article: string; itemId: string }[] {
  const variants = item.variants ?? [];
  const axes = axesOf(variants);
  const colour = axes.find((axis) => axis.colour);
  const current = variants.find((variant) => variant.itemId === item.id);
  const ordered = colour
    ? colour.options.map((option) => {
      const article = variants.find((variant) => valuesOf(variant).get(colour.code)?.text === option && variant.article)?.article;
      const target = current ? pickVariant(variants, axes, current, colour, option) : undefined;
      return { article, itemId: target?.itemId ?? item.id };
    })
    : variants.map((variant) => ({ article: variant.article, itemId: variant.itemId }));
  const all = [{ article: item.article, itemId: item.id }, ...ordered]
    .filter((entry): entry is { article: string; itemId: string } => !!entry.article);
  return all.filter((entry, index) => all.findIndex((other) => other.article === entry.article) === index);
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
      {shown.map(({ article, itemId }, index) => (
        <span key={article}>
          {index > 0 ? ', ' : ''}
          {/* Код не рвётся на дефисе: «LOW-ELE-» на одной строке и «BEG» на другой читались двумя артикулами (QA 360px).
              Артикул другого цвета — ссылкой на него, как кружок цвета (просьба владельца 2026-11-20). */}
          {itemId === item.id ? (
            <span aria-current="page" className="whitespace-nowrap font-semibold text-ink-muted">{article}</span>
          ) : (
            <Link to={`/catalog/${itemId}`} replace
              className="whitespace-nowrap rounded-[4px] text-accent-ink underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {article}
            </Link>
          )}
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
