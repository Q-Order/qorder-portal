import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Номер — одна логика на front, portal и admin: `phone.ts` одинаков во всех
 * трёх, поле `Plus7Input.tsx` — в портале и админке (у front своё, с Mantine).
 * Копии сверяются побайтно; соседнего проекта рядом нет — сверять не с чем.
 */
const COPIES: Record<string, string[]> = {
  'phone.ts': ['front', 'portal', 'admin'],
  'Plus7Input.tsx': ['portal', 'admin'],
};

describe('копии кода номера', () => {
  const self = basename(process.cwd());
  for (const [file, projects] of Object.entries(COPIES)) {
    if (!projects.includes(self)) continue;
    const own = readFileSync(resolve('src/shared', file), 'utf8');
    for (const project of projects.filter((p) => p !== self)) {
      const copy = resolve('..', project, 'src/shared', file);
      it.skipIf(!existsSync(copy))(`${file} совпадает с ${project}`, () => {
        expect(readFileSync(copy, 'utf8')).toBe(own);
      });
    }
  }
});
