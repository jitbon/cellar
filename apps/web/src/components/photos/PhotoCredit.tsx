import styles from './PhotoCredit.module.css';

interface Props {
  /** The photographer or author, as the source gives it. */
  credit: string;
  license?: string;
  /** Where the credit links to (file page or author page); null shows plain text. */
  href: string | null;
  /** Light text for use on the photo overlay. */
  variant?: 'default' | 'onPhoto';
}

/** "Photo: Jane Doe · CC BY-SA 4.0", linked to the source, as the photo licenses require. */
export function PhotoCredit({ credit, license, href, variant = 'default' }: Props) {
  if (!credit) return null;
  const text = `Photo: ${credit}${license ? ` · ${license}` : ''}`;
  const className = `${styles.credit} ${variant === 'onPhoto' ? styles.onPhoto : ''}`;
  return href ? (
    <a
      className={className}
      data-variant={variant}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {text}
    </a>
  ) : (
    <span className={className} data-variant={variant}>
      {text}
    </span>
  );
}
