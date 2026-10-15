import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactElement, ReactNode } from 'react';
import { Icon } from './Icon';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import styles from './Menu.module.css';

interface MenuProps {
  trigger: ReactElement;
  children: ReactNode;
}

/** A token-styled dropdown menu: keyboard navigation, Escape, and focus return come from Radix. */
export function Menu({ trigger, children }: MenuProps) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.content} sideOffset={4} align="end">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface ItemProps {
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: ComponentType<LucideProps>;
  'aria-label'?: string;
  children: ReactNode;
}

export function MenuItem({ onSelect, danger, disabled, icon, children, ...rest }: ItemProps) {
  return (
    <DropdownMenu.Item
      className={`${styles.item} ${danger ? styles.danger : ''}`}
      onSelect={onSelect}
      disabled={disabled}
      {...rest}
    >
      {icon && <Icon as={icon} />}
      <span>{children}</span>
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className={styles.separator} />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className={styles.label}>{children}</DropdownMenu.Label>;
}
