import styles from './RepeatCount.module.css';

/** Hidden text after a struck-through name: ", placed" or ", placed 3 times". */
export function placedText(count: number): string {
  return count > 1 ? `, placed ${count} times` : ', placed';
}

/**
 * "×2", "×3"… beside a name placed on the schedule more than once. Nothing for one or none; the
 * strikethrough already says "placed". Screen readers get the count from `placedText`.
 */
export function RepeatCount({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <span className={styles.count} aria-hidden="true">
      ×{count}
    </span>
  );
}
