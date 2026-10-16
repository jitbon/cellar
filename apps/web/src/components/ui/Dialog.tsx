import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, X } from './Icon';
import styles from './Dialog.module.css';

interface Props {
  title: string;
  wide?: boolean;
  /** Also close when the backdrop (outside the dialog) is clicked; off for forms. */
  closeOnBackdrop?: boolean;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: focus is trapped inside, Esc or the X closes without saving, focus returns to the
 * opener.
 */
export function Dialog({ title, wide, closeOnBackdrop, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // A drag that starts in the dialog (text selection) and ends on the backdrop is not a click on it.
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    return () => opener?.focus?.();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    // Keys from a menu portaled out of the dialog (React still bubbles them here) are the menu's:
    // Escape closes just that menu, not this dialog or anything behind it.
    if (!ref.current?.contains(e.target as Node)) {
      if (e.key === 'Escape') e.stopPropagation();
      return;
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }

  // Portaled so no sticky or transformed ancestor can trap or clip the modal.
  return createPortal(
    <div
      className={styles.backdrop}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (closeOnBackdrop && pressedBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${styles.dialog} ${wide ? styles.wide : ''}`}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children}
        {/* Last in the DOM so opening still focuses the first field; placed top-right by CSS. */}
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          <Icon as={X} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
