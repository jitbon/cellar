/** A provider-style type (e.g. `art_museum`) as words ("Art museum"); empty when there is none. */
export function kindLabel(category: string | null): string {
  const words = (category ?? '').replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
