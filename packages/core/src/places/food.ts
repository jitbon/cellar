const FOOD_TYPES = new Set([
  'restaurant',
  'cafe',
  'coffee_shop',
  'bar',
  'bakery',
  'meal_takeaway',
  'meal_delivery',
  'food_court',
  'ice_cream_shop',
  'dessert_shop',
  'food',
]);

/** True for places to eat or drink; cuisine-specific `*_restaurant` types count too. */
export function isFoodPlace(types: string[]): boolean {
  return types.some((t) => FOOD_TYPES.has(t) || t.endsWith('_restaurant'));
}
