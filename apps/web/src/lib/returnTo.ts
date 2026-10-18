/** Only same-origin absolute paths are allowed as a post-sign-in destination. */
export function safeReturnTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}
