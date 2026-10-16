import { validationError, type ValidationError } from './errors';
import type { ISODate, Location, Place, TimeWindow } from './types';

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

export function validateLocation(loc: Location): ValidationError | null {
  const name = loc.name.trim().length;
  const valid =
    name >= 1 &&
    name <= 120 &&
    Number.isFinite(loc.lat) &&
    loc.lat >= -90 &&
    loc.lat <= 90 &&
    Number.isFinite(loc.lon) &&
    loc.lon >= -180 &&
    loc.lon <= 180 &&
    loc.tz.length > 0;
  return valid ? null : validationError('INVALID_LOCATION', 'That location is not valid.');
}

/** `null` (a plain row with no place) is valid. */
export function validatePlace(place: Place | null): ValidationError | null {
  if (place === null) return null;
  const valid =
    place.id.length >= 1 &&
    place.id.length <= 300 &&
    place.provider === 'google' &&
    place.name.trim().length >= 1 &&
    place.name.trim().length <= 200 &&
    place.address.length <= 300 &&
    Number.isFinite(place.lat) &&
    place.lat >= -90 &&
    place.lat <= 90 &&
    Number.isFinite(place.lon) &&
    place.lon >= -180 &&
    place.lon <= 180 &&
    (place.category === null || place.category.length <= 100);
  return valid ? null : validationError('INVALID_PLACE', 'That place is not valid.');
}

/** A Commons file name: 1-300 characters (matches the trips.cover_photo check). */
export function validateCoverPhoto(file: string): ValidationError | null {
  return file.length >= 1 && file.length <= 300
    ? null
    : validationError('INVALID_COVER_PHOTO', 'That cover photo is not valid.');
}

/** A Commons file name: 1-300 characters (matches the trips.banner_photo check). */
export function validateBannerPhoto(file: string): ValidationError | null {
  return file.length >= 1 && file.length <= 300
    ? null
    : validationError('INVALID_BANNER_PHOTO', 'That banner photo is not valid.');
}

export function validateWindow(win: TimeWindow): ValidationError | null {
  const inDay = (m: number) => Number.isInteger(m) && m >= 0 && m <= 1439;
  if (!inDay(win.startMin) || !inDay(win.endMin) || win.startMin === win.endMin) {
    return validationError('INVALID_WINDOW', 'The end time must differ from the start time.');
  }
  return null;
}
