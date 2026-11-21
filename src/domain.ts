import type { Catalog } from './data/schema';

export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function searchRecipes(catalog: Catalog, query: string) {
  const term = normalize(query);
  return catalog.recipes.filter(recipe => normalize([
    recipe.title, ...recipe.aliases,
    ...recipe.ingredients.flatMap(line => {
      const ingredient = catalog.ingredients.find(item => item.id === line.ingredientId);
      return ingredient ? [ingredient.name, ...ingredient.aliases] : [];
    }),
  ].join(' ')).includes(term));
}
export function localDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function weekStart(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return localDate(date);
}
export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
