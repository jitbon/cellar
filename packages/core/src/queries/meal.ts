import type { Block } from '../model/types';

// Whole words only, so "Teamwork" is not a meal but "Tea" is.
const MEAL_WORDS =
  /\b(breakfast|brunch|lunch|dinner|supper|dessert|snacks?|meals?|tea|coffee|drinks|happy hour)\b/i;

/** Whether a row name reads as a meal (used while a row follows its name). */
export function isMealName(name: string): boolean {
  return MEAL_WORDS.test(name);
}

/** The traveler's explicit choice wins; otherwise the row follows its name. */
export function isMealBlock(block: Block): boolean {
  return block.isMeal ?? isMealName(block.name);
}
