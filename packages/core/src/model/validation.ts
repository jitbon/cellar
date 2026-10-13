import { validationError, type ValidationError } from './errors';
import type { ISODate } from './types';

export const MAX_TRIP_DAYS = 60;

function validateName(label: string, name: string, max: number): ValidationError | null {
  const len = name.trim().length;
  if (len === 0) return validationError('EMPTY_NAME', `${label} is required.`);
  if (len > max)
    return validationError('EMPTY_NAME', `${label} must be at most ${max} characters.`);
  return null;
}

export const validateTripName = (name: string) => validateName('Trip name', name, 100);
export const validateBlockName = (name: string) => validateName('Block name', name, 40);
export const validateItemName = (name: string) => validateName('Name', name, 200);

export function validateNotes(notes: string | null): ValidationError | null {
  if (notes !== null && notes.length > 5000) {
    return validationError('EMPTY_NAME', 'Notes must be at most 5,000 characters.');
  }
  return null;
}

export function validateLink(link: string | null): ValidationError | null {
  if (link === null || link === '') return null;
  if (/^https?:\/\/[^\s/?#]+[^\s]*$/i.test(link)) return null;
  return validationError('INVALID_LINK', 'Link must be an http(s) URL.');
}

export function parseISODate(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function formatISODate(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

export function daysBetween(start: ISODate, end: ISODate): number {
  return Math.round((parseISODate(end) - parseISODate(start)) / DAY_MS);
}

export function validateDateRange(start: ISODate, end: ISODate): ValidationError | null {
  const span = daysBetween(start, end);
  if (span < 0)
    return validationError('END_BEFORE_START', 'End date must be on or after the start date.');
  if (span > MAX_TRIP_DAYS - 1) {
    return validationError('RANGE_TOO_LONG', `A trip can span at most ${MAX_TRIP_DAYS} days.`);
  }
  return null;
}
