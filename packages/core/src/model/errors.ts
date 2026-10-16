export type ValidationCode =
  | 'EMPTY_NAME'
  | 'END_BEFORE_START'
  | 'RANGE_TOO_LONG'
  | 'LAST_BLOCK'
  | 'ARRIVAL_AFTER_DEPARTURE'
  | 'DATE_OUT_OF_RANGE'
  | 'INVALID_LINK'
  | 'INVALID_LOCATION'
  | 'INVALID_COVER_PHOTO'
  | 'INVALID_PLACE'
  | 'INVALID_WINDOW'
  | 'NOT_FOUND';

export interface ValidationError {
  code: ValidationCode;
  message: string;
}

export function validationError(code: ValidationCode, message: string): ValidationError {
  return { code, message };
}
