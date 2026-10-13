import { describe, expect, it } from 'vitest';
import {
  validateBlockName,
  validateDateRange,
  validateItemName,
  validateLink,
  validateNotes,
  validateTripName,
} from '../src/model/validation';

describe('names', () => {
  it('trip name is required, 1-100 chars after trim', () => {
    expect(validateTripName('  ')?.code).toBe('EMPTY_NAME');
    expect(validateTripName('')?.code).toBe('EMPTY_NAME');
    expect(validateTripName('a')).toBeNull();
    expect(validateTripName('a'.repeat(100))).toBeNull();
    expect(validateTripName('a'.repeat(101))?.code).toBe('EMPTY_NAME');
    expect(validateTripName(' ' + 'a'.repeat(100) + ' ')).toBeNull();
  });

  it('block name is required, 1-40 chars', () => {
    expect(validateBlockName('')?.code).toBe('EMPTY_NAME');
    expect(validateBlockName('a'.repeat(40))).toBeNull();
    expect(validateBlockName('a'.repeat(41))?.code).toBe('EMPTY_NAME');
  });

  it('item/placement name is required, 1-200 chars', () => {
    expect(validateItemName(' ')?.code).toBe('EMPTY_NAME');
    expect(validateItemName('a'.repeat(200))).toBeNull();
    expect(validateItemName('a'.repeat(201))?.code).toBe('EMPTY_NAME');
  });
});

describe('notes', () => {
  it('allows null and up to 5,000 chars', () => {
    expect(validateNotes(null)).toBeNull();
    expect(validateNotes('a'.repeat(5000))).toBeNull();
    expect(validateNotes('a'.repeat(5001))).not.toBeNull();
  });
});

describe('link', () => {
  it('must be an http(s) URL if present', () => {
    expect(validateLink(null)).toBeNull();
    expect(validateLink('https://example.com/x')).toBeNull();
    expect(validateLink('http://example.com')).toBeNull();
    expect(validateLink('ftp://example.com')?.code).toBe('INVALID_LINK');
    expect(validateLink('javascript:alert(1)')?.code).toBe('INVALID_LINK');
    expect(validateLink('not a url')?.code).toBe('INVALID_LINK');
  });
});

describe('date range', () => {
  it('end must be on or after start', () => {
    expect(validateDateRange('2027-04-05', '2027-04-01')?.code).toBe('END_BEFORE_START');
    expect(validateDateRange('2027-04-01', '2027-04-01')).toBeNull();
  });

  it('spans at most 60 days', () => {
    expect(validateDateRange('2027-01-01', '2027-03-01')).toBeNull(); // 60 days inclusive
    expect(validateDateRange('2027-01-01', '2027-03-02')?.code).toBe('RANGE_TOO_LONG');
  });
});
