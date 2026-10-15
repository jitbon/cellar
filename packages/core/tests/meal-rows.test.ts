import { describe, expect, it } from 'vitest';
import { addBlock, renameBlock, setBlockMeal } from '../src/commands/block';
import { isMealBlock, isMealName } from '../src/queries/meal';
import { blockIdByName, expectOk, newTripState } from './fixtures';

const block = (state: ReturnType<typeof newTripState>, name: string) =>
  state.blocks.find((b) => b.name === name)!;

describe('isMealName', () => {
  it('recognizes meal words in any case', () => {
    for (const name of [
      'Breakfast',
      'Brunch',
      'lunch',
      'Dinner',
      'Supper',
      'Dessert',
      'Snacks',
      'Late lunch',
      'Happy hour',
      'Drinks',
      'Tea',
    ]) {
      expect(isMealName(name)).toBe(true);
    }
  });

  it('does not match activity names or partial words', () => {
    for (const name of [
      'Morning',
      'Afternoon',
      'Evening',
      'Night',
      'Late morning',
      'Teamwork',
      'Museum',
    ]) {
      expect(isMealName(name)).toBe(false);
    }
  });
});

describe('meal rows', () => {
  it('new trips start in auto mode, so default meal rows follow their names', () => {
    const s = newTripState();
    expect(s.blocks.every((b) => b.isMeal === null)).toBe(true);
    const meals = s.blocks.filter(isMealBlock).map((b) => b.name);
    expect(meals).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Dessert']);
  });

  it('auto mode follows renames', () => {
    const s = newTripState();
    const r = expectOk(renameBlock(blockIdByName(s, 'Afternoon'), 'Lunch break')(s));
    expect(isMealBlock(block(r.state, 'Lunch break'))).toBe(true);
  });

  it('an explicit setting overrides the name and survives renames', () => {
    const s = newTripState();
    const lunch = blockIdByName(s, 'Lunch');
    const off = expectOk(setBlockMeal(lunch, false)(s));
    expect(isMealBlock(block(off.state, 'Lunch'))).toBe(false);

    const afternoon = blockIdByName(s, 'Afternoon');
    const on = expectOk(setBlockMeal(afternoon, true)(off.state));
    const renamed = expectOk(renameBlock(afternoon, 'Noodles')(on.state));
    expect(isMealBlock(block(renamed.state, 'Noodles'))).toBe(true);
  });

  it('null returns a row to auto mode', () => {
    const s = newTripState();
    const lunch = blockIdByName(s, 'Lunch');
    const off = expectOk(setBlockMeal(lunch, false)(s));
    const auto = expectOk(setBlockMeal(lunch, null)(off.state));
    expect(block(auto.state, 'Lunch').isMeal).toBeNull();
    expect(isMealBlock(block(auto.state, 'Lunch'))).toBe(true);
  });

  it('emits one block upsert and undoes', () => {
    const s = newTripState();
    const r = expectOk(setBlockMeal(blockIdByName(s, 'Lunch'), false)(s));
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({ table: 'blocks', op: 'upsert', row: { isMeal: false } });
    expect(block(expectOk(r.inverse(r.state)).state, 'Lunch').isMeal).toBeNull();
  });

  it('rejects an unknown block', () => {
    expect(setBlockMeal('nope', true)(newTripState()).ok).toBe(false);
  });

  it('added blocks start in auto mode', () => {
    const s = newTripState();
    const r = expectOk(addBlock('Snack')(s));
    expect(block(r.state, 'Snack').isMeal).toBeNull();
    expect(isMealBlock(block(r.state, 'Snack'))).toBe(true);
  });
});
