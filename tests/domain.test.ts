import { expect, it } from 'vitest';
import { addDays, searchRecipes, weekStart } from '../src/domain';
import { validateCatalog } from '../src/data/schema';
import { fixtureCatalog } from './fixtures/catalog';

it('searches aliases and ingredients independent of case and accents', () => {
  const catalog = validateCatalog(fixtureCatalog);
  expect(searchRecipes(catalog, 'SINÁNGAG')[0].id).toBe('r_dev_sinangag');
  expect(searchRecipes(catalog, 'bawang')[0].id).toBe('r_dev_sinangag');
  expect(searchRecipes(catalog, 'not a dish')).toEqual([]);
});
it('uses Monday calendar weeks across year boundaries', () => {
  expect(weekStart('2027-01-03')).toBe('2026-12-28');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
});
