export const fixtureCatalog = {
  formatVersion: 1,
  releaseId: 'dev-fixture-1',
  kind: 'development',
  ingredients: [
    { id: 'i_rice', name: 'Cooked rice', aliases: ['kanin'], aisle: 'grains' },
    { id: 'i_garlic', name: 'Garlic', aliases: ['bawang'], aisle: 'produce' },
    { id: 'i_oil', name: 'Cooking oil', aliases: [], aisle: 'pantry' },
    { id: 'i_egg', name: 'Egg', aliases: ['itlog'], aisle: 'dairy and eggs' },
  ],
  sources: [{ id: 's_dev', creator: 'Project development fixture (AI-assisted)', source: 'tests/fixtures/README.md', acquiredAt: '2026-11-22', rights: 'Original development-only material', license: 'Project fixture; no third-party license', attribution: 'Ulam development fixture', modifications: 'Original draft and illustration', reviewedAt: '2026-11-22', evidence: 'tests/fixtures/README.md' }],
  images: [{ id: 'img_dev_rice', path: 'tests/fixtures/garlic-rice.svg', width: 320, height: 240, format: 'svg', byteLength: 687, sha256: 'f8fdeded6eac4ddff5665dce0223e797212b32aa8ff02444e96bf183a4e53608', alt: 'Illustration of garlic fried rice on a plate', sourceId: 's_dev' }, { id: 'img_dev_egg', path: 'tests/fixtures/fried-egg.svg', width: 320, height: 240, format: 'svg', byteLength: 542, sha256: 'e7b7a0d8f607b83dcda2ee1d8d40538727886a9dd84a030b954c34841f31c427', alt: 'Illustration of a fried egg on a plate', sourceId: 's_dev' }],
  recipes: [{
    id: 'r_dev_sinangag', revision: 1, title: 'Garlic fried rice', aliases: ['sinangag'], summary: 'A simple garlic fried rice development fixture.', tags: ['Filipino'], mealSlots: ['breakfast'], allergens: { status: 'unknown', items: [] }, yieldServings: 2, prepMinutes: 5, cookMinutes: 8, imageId: 'img_dev_rice', sourceIds: ['s_dev'], reviewStatus: 'development',
    ingredients: [
      { id: 'line_rice', ingredientId: 'i_rice', amount: { kind: 'exact', numerator: 2, denominator: 1 }, unit: 'cup', form: 'cooked', prepNote: 'cooled', optional: false },
      { id: 'line_garlic', ingredientId: 'i_garlic', amount: { kind: 'exact', numerator: 3, denominator: 1 }, unit: 'clove', form: 'minced', prepNote: '', optional: false },
      { id: 'line_oil', ingredientId: 'i_oil', amount: { kind: 'exact', numerator: 1, denominator: 1 }, unit: 'tbsp', form: 'liquid', prepNote: '', optional: false },
    ],
    steps: [
      { id: 'step_garlic', text: 'Heat the oil in a skillet over medium heat and stir the garlic for about 1 minute until fragrant.', ingredientLineIds: ['line_oil', 'line_garlic'], timerSeconds: 60 },
      { id: 'step_rice', text: 'Add the rice and stir over medium heat for about 7 minutes until piping hot throughout.', ingredientLineIds: ['line_rice'], timerSeconds: 420 },
    ],
  }, {
    id: 'r_dev_egg', revision: 1, title: 'Fried egg', aliases: ['pritong itlog'], summary: 'A simple fried egg development fixture.', tags: ['breakfast'], mealSlots: ['breakfast'], allergens: { status: 'unknown', items: ['egg'] }, yieldServings: 1, prepMinutes: 1, cookMinutes: 4, imageId: 'img_dev_egg', sourceIds: ['s_dev'], reviewStatus: 'development',
    ingredients: [
      { id: 'line_egg', ingredientId: 'i_egg', amount: { kind: 'exact', numerator: 1, denominator: 1 }, unit: 'piece', form: 'whole', prepNote: '', optional: false },
      { id: 'line_oil', ingredientId: 'i_oil', amount: { kind: 'exact', numerator: 1, denominator: 1 }, unit: 'tsp', form: 'liquid', prepNote: '', optional: false },
    ],
    steps: [{ id: 'step_egg', text: 'Heat the oil in a skillet over medium heat, add the egg, and cook for about 4 minutes until the white and yolk are firm.', ingredientLineIds: ['line_egg', 'line_oil'], timerSeconds: 240 }],
  }],
};
export const invalidCatalog = { ...fixtureCatalog, releaseId: 'dev-invalid', recipes: [{ ...fixtureCatalog.recipes[0], imageId: 'img_missing' }] };
export const nextCatalog = { ...fixtureCatalog, releaseId: 'dev-fixture-2', recipes: [{ ...fixtureCatalog.recipes[0], revision: 2, title: 'Garlic rice, revised fixture' }] };
export const guestPlan = { weekStart: '2026-11-16', date: '2026-11-22', slot: 'dinner', recipeId: 'r_dev_sinangag', catalogReleaseId: 'dev-fixture-1', recipeRevision: 1, servings: 2, updatedAt: '2026-11-22T09:30:00.000Z' };
