import { describe, expect, it } from 'vitest';
import { isFoodPlace } from '../src/places/food';

describe('isFoodPlace', () => {
  it.each([
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
    'ramen_restaurant',
  ])('is true for %s', (type) => {
    expect(isFoodPlace([type])).toBe(true);
  });

  it('is true when any type matches', () => {
    expect(isFoodPlace(['point_of_interest', 'mexican_restaurant', 'establishment'])).toBe(true);
  });

  it('is false for markets, museums and no types', () => {
    expect(isFoodPlace(['market', 'point_of_interest'])).toBe(false);
    expect(isFoodPlace(['museum'])).toBe(false);
    expect(isFoodPlace([])).toBe(false);
  });
});
