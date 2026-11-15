import { forwardRef } from 'react';
import { cn } from '../../ui/cn';
import type { IconComponent, IconProps } from '../../ui/icons';

/*
 * Значки плиток «Главной» — Phosphor Bold (решение владельца 2026-10-30):
 * жирный контур, внутри пусто. Тот же набор, что в остальном кабинете
 * (ui/icons), только толще. Цвет — один на все (`text-home-icon`), его не
 * перекрашивает продавец.
 *
 * Phosphor — лицензия MIT. Разметка взята из набора как есть: это
 * постоянные строки, а не данные с сервера, поэтому вставляются напрямую.
 */

function bold(body: string): IconComponent {
  return forwardRef<SVGSVGElement, IconProps>(function PhosphorBold({ size = 24, strokeWidth: _, ...props }, ref) {
    return (
      <svg ref={ref} xmlns='http://www.w3.org/2000/svg' width={size} height={size} viewBox='0 0 256 256'
        aria-hidden='true' {...props} dangerouslySetInnerHTML={{ __html: body }} />
    );
  });
}

export const HomeHouse = bold(`<path fill="currentColor" d="m222.14 105.85l-80-80a20 20 0 0 0-28.28 0l-80 80A19.86 19.86 0 0 0 28 120v96a12 12 0 0 0 12 12h64a12 12 0 0 0 12-12v-52h24v52a12 12 0 0 0 12 12h64a12 12 0 0 0 12-12v-96a19.86 19.86 0 0 0-5.86-14.15M204 204h-40v-52a12 12 0 0 0-12-12h-48a12 12 0 0 0-12 12v52H52v-82.35l76-76l76 76Z"/>`);

/** «Все разделы» — четыре точки (Phosphor DotsFour Bold), как в шапке макета. */
export const HomeMore = bold(`<path fill="currentColor" d="M72 104a32 32 0 1 1 32-32a32 32 0 0 1-32 32m112 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32M72 216a32 32 0 1 1 32-32a32 32 0 0 1-32 32m112 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32"/>`);

export const HomeMessages = bold(`<path fill="currentColor" d="M172 108a12 12 0 0 1-12 12H96a12 12 0 0 1 0-24h64a12 12 0 0 1 12 12m-12 28H96a12 12 0 0 0 0 24h64a12 12 0 0 0 0-24m76-8a108 108 0 0 1-157.23 96.15L46.34 235A20 20 0 0 1 21 209.66l10.81-32.43A108 108 0 1 1 236 128m-24 0a84 84 0 1 0-156.73 42.06a12 12 0 0 1 1 9.81l-9.93 29.79l29.79-9.93a12.1 12.1 0 0 1 3.8-.62a12 12 0 0 1 6 1.62A84 84 0 0 0 212 128"/>`);

export const HomeCatalog = bold(`<path fill="currentColor" d="M100 36H56a20 20 0 0 0-20 20v44a20 20 0 0 0 20 20h44a20 20 0 0 0 20-20V56a20 20 0 0 0-20-20m-4 60H60V60h36Zm104-60h-44a20 20 0 0 0-20 20v44a20 20 0 0 0 20 20h44a20 20 0 0 0 20-20V56a20 20 0 0 0-20-20m-4 60h-36V60h36Zm-96 40H56a20 20 0 0 0-20 20v44a20 20 0 0 0 20 20h44a20 20 0 0 0 20-20v-44a20 20 0 0 0-20-20m-4 60H60v-36h36Zm104-60h-44a20 20 0 0 0-20 20v44a20 20 0 0 0 20 20h44a20 20 0 0 0 20-20v-44a20 20 0 0 0-20-20m-4 60h-36v-36h36Z"/>`);

export const HomeCart = bold(`<path fill="currentColor" d="M233.21 56.31A12 12 0 0 0 224 52H66l-5.47-30.15A12 12 0 0 0 48.73 12H24a12 12 0 0 0 0 24h14.71l24.91 137a28 28 0 0 0 4.07 10.21A32 32 0 1 0 123 196h34a32 32 0 1 0 31-24H91.17a4 4 0 0 1-3.93-3.28L84.92 156H196.1a28 28 0 0 0 27.55-23l12.16-66.86a12 12 0 0 0-2.6-9.83M100 204a8 8 0 1 1-8-8a8 8 0 0 1 8 8m88 8a8 8 0 1 1 8-8a8 8 0 0 1-8 8m12-83.28a4 4 0 0 1-3.9 3.28H80.56L70.38 76h139.24Z"/>`);

export const HomeDelivery = bold(`<path fill="currentColor" d="m255.14 115.54l-14-35A19.89 19.89 0 0 0 222.58 68H196v-4a12 12 0 0 0-12-12H32a20 20 0 0 0-20 20v112a20 20 0 0 0 20 20h14.06a36 36 0 0 0 67.88 0h44.12a36 36 0 0 0 67.88 0H236a20 20 0 0 0 20-20v-64a21.7 21.7 0 0 0-.86-4.46M196 92h23.88l6.4 16H196ZM80 204a12 12 0 1 1 12-12a12 12 0 0 1-12 12m92-41.92A36.32 36.32 0 0 0 158.06 180h-44.12a36 36 0 0 0-67.88 0H36v-40h136Zm0-46.08H36V76h136Zm20 88a12 12 0 1 1 12-12a12 12 0 0 1-12 12m40-24h-6.06A36.09 36.09 0 0 0 196 156.23V132h36Z"/>`);

export const HomeRepeat = bold(`<path fill="currentColor" d="M228 128a100 100 0 0 1-98.66 100H128a99.4 99.4 0 0 1-68.62-27.29a12 12 0 0 1 16.48-17.45a76 76 0 1 0-1.57-109c-.13.13-.25.25-.39.37L54.89 92H72a12 12 0 0 1 0 24H24a12 12 0 0 1-12-12V56a12 12 0 0 1 24 0v20.72l21.48-19.66A100 100 0 0 1 228 128"/>`);


/**
 * «Каталог товаров» на «Главной» — витрина магазина (рисунок владельца 2026-11-13,
 * temp/catalog-vitrina.svg): контур, а не заливка Phosphor. Цвет — `currentColor`, как у соседних
 * плиток (`text-home-icon`), чтобы и тёмная тема, и тон плитки оставались общими.
 */
export const HomeShowcase = forwardRef<SVGSVGElement, IconProps>(function HomeShowcase({ size = 24, strokeWidth: _, className, ...props }, ref) {
  return (
    <svg ref={ref} xmlns='http://www.w3.org/2000/svg' width={size} height={size} viewBox='1.6 -0.4 52.8 52.8' fill='none'
      stroke='currentColor' strokeWidth={TILE_LINE} strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'
      className={cn(SAME_LINE, className)} {...props}>
      <rect x='2' y='4' width='52' height='44' rx='4' />
      <path d='M2 13h52M9 8.5h.1m5 0h.1m5 0h.1M42 21h6m-6 6h4m-4 6h6m-6 6h4' />
      <path d='M9 21h10l1 7H8zM12 21v-1a2 2 0 0 1 4 0v1' />
      <path d='M28 18h4v3l2 2v5h-8v-5l2-2z' />
      <rect x='9' y='33' width='11' height='9' rx='1' />
      <path d='M14.5 33v3m12-3 2-1 1.5 2h2l1.5-2 2 1 2 3-3 2v4h-7v-4l-3-2z' />
    </svg>
  );
});

/*
 * Значки плиток «Главной» — одной толщины линии (просьба владельца 2026-11-15): контуром, как витрина
 * выше, и линия задана в пикселях экрана (`non-scaling-stroke`), а не в долях рисунка, — у плитки 44 px
 * на телефоне и 56 px на мониторе она одна и та же. Жирные Phosphor давали 4–5 px против 1,6 px витрины.
 * Рисунки — Lucide (ISC). Нижнее меню остаётся на Phosphor (`HomeMessages` и соседи).
 * Размер — по «Мои заявки» (просьба владельца 2026-11-15): рисунок в высоту 5/6 плитки; поле вокруг
 * остальных обрезано в `viewBox`, иначе круг и витрина выходили мельче планшета.
 */
const TILE_LINE = 2;
const SAME_LINE = '[&_*]:[vector-effect:non-scaling-stroke]';

function line(body: string, viewBox = '0 0 24 24'): IconComponent {
  return forwardRef<SVGSVGElement, IconProps>(function TileLine({ size = 24, strokeWidth: _, className, ...props }, ref) {
    return (
      <svg ref={ref} xmlns='http://www.w3.org/2000/svg' width={size} height={size} viewBox={viewBox} fill='none'
        stroke='currentColor' strokeWidth={TILE_LINE} strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'
        className={cn(SAME_LINE, className)} {...props} dangerouslySetInnerHTML={{ __html: body }} />
    );
  });
}

export const TileOrders = line('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/>');
export const TileRepeat = line('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>', '1.2 1.2 21.6 21.6');
export const TileAsk = line('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 10h8M8 14h5"/>', '0.1 1.1 22.8 22.8');
