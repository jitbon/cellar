import type { Location } from '@cellar/core';
import { useServices } from '../../state/services';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { LocationPicker } from './LocationPicker';
import styles from './LocationDialog.module.css';

interface Props {
  title: string;
  /** Current location, shown for context. */
  current: Location | null;
  onSelect: (location: Location) => void;
  /** Offered when set: clears the location (e.g. "Remove location"). */
  clearLabel?: string;
  onClear?: () => void;
  onClose: () => void;
}

export function LocationDialog({ title, current, onSelect, clearLabel, onClear, onClose }: Props) {
  const { weather } = useServices();
  return (
    <Dialog title={title} onClose={onClose}>
      <div className={styles.body}>
        {current ? <p className={styles.current}>Now: {current.name}</p> : null}
        <LocationPicker
          service={weather}
          onSelect={(location) => {
            onSelect(location);
            onClose();
          }}
        />
        <div className={styles.actions}>
          {onClear && clearLabel ? (
            <Button
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              {clearLabel}
            </Button>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  );
}
