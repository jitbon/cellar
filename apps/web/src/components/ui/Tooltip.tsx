import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactElement } from 'react';
import styles from './Tooltip.module.css';

export const TooltipProvider = RadixTooltip.Provider;

/** Shows `label` on hover or keyboard focus after a short delay. */
export function Tooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <RadixTooltip.Root delayDuration={400}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className={styles.content} sideOffset={4}>
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
