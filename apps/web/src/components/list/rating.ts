import type { PopularPlace } from '@cellar/core';

/** "4.8 (104,512 reviews)"; whatever part the provider did not give is left out. */
export function ratingText(place: PopularPlace): string {
  if (place.rating === null) return '';
  const rating = place.rating.toFixed(1);
  if (place.ratingCount === null) return rating;
  const reviews = place.ratingCount === 1 ? 'review' : 'reviews';
  return `${rating} (${place.ratingCount.toLocaleString('en-US')} ${reviews})`;
}
