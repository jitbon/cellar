import type { Place } from '@cellar/core';
import { Icon, MapPin } from '../ui/Icon';
import styles from './PlaceLine.module.css';

/** The linked-place marker: a pin and the short address (text as well as icon, not color). */
export function PlaceLine({ place }: { place: Place | null }) {
  if (!place) return null;
  const text = place.address || place.name;
  return (
    <span className={styles.line} title={text}>
      <Icon as={MapPin} size="small" role="img" aria-label="Linked place" />
      <span className={styles.text}>{text}</span>
    </span>
  );
}
