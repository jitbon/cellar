import * as RadixTooltip from '@radix-ui/react-tooltip';
import { useRef, useState, type ReactElement } from 'react';
import styles from './Tooltip.module.css';

export const TooltipProvider = RadixTooltip.Provider;

interface Props {
  label: string;
  /** Checked each time the tooltip would open; return false to skip it (e.g. text not truncated). */
  when?: (trigger: HTMLElement) => boolean;
  children: ReactElement;
}

/** Shows `label` on hover or keyboard focus after a short delay. */
export function Tooltip({ label, when, children }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    // A local provider keeps components that use Tooltip renderable on their own (unit tests).
    <RadixTooltip.Provider delayDuration={400}>
      <RadixTooltip.Root
        open={open}
        onOpenChange={(next) => {
          if (next && when && triggerRef.current && !when(triggerRef.current)) return;
          setOpen(next);
        }}
      >
        <RadixTooltip.Trigger asChild ref={triggerRef}>
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className={styles.content} sideOffset={4}>
            {label}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
