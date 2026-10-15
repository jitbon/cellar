import { Link } from 'react-router';
import {
  ArrowLeft,
  CalendarDays,
  Icon,
  MapPin,
  MoreHorizontal,
  PanelRight,
  Redo2,
  Undo2,
} from '../ui/Icon';
import { Menu, MenuItem } from '../ui/Menu';
import { Tooltip } from '../ui/Tooltip';
import styles from './TripHeader.module.css';

interface Props {
  name: string;
  /** e.g. "Oct 15 – Oct 19 · 5 days" */
  rangeLabel: string;
  locationName: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onEditDates: () => void;
  onEditLocation: () => void;
  onOpenSettings: () => void;
  /** The item panel toggle; omitted when the panel is not available. */
  panel?: { open: boolean; onToggle: () => void };
}

/** The single 48 px navy bar at the top of the planner. */
export function TripHeader({
  name,
  rangeLabel,
  locationName,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onEditDates,
  onEditLocation,
  onOpenSettings,
  panel,
}: Props) {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.back} aria-label="Trips">
        <Icon as={ArrowLeft} />
        <span className={styles.backText}>Trips</span>
      </Link>
      <h1 className={styles.name}>{name}</h1>
      <button
        type="button"
        className={styles.chip}
        aria-label={`Change trip dates (${rangeLabel})`}
        onClick={onEditDates}
      >
        <Icon as={CalendarDays} />
        <span>{rangeLabel}</span>
      </button>
      <button
        type="button"
        className={styles.chip}
        aria-label={locationName ? `Change trip location (${locationName})` : 'Add a location'}
        onClick={onEditLocation}
      >
        <Icon as={MapPin} />
        <span className={styles.locationText}>{locationName ?? 'Add a location'}</span>
      </button>
      <span className={styles.spacer} />
      <Tooltip label="Undo">
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Undo"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Icon as={Undo2} />
        </button>
      </Tooltip>
      <Tooltip label="Redo">
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Redo"
          onClick={onRedo}
          disabled={!canRedo}
        >
          <Icon as={Redo2} />
        </button>
      </Tooltip>
      {panel ? (
        <button
          type="button"
          className={styles.chip}
          aria-label="Show list"
          aria-expanded={panel.open}
          onClick={panel.onToggle}
        >
          <Icon as={PanelRight} />
          <span className={styles.itemsText}>Items</span>
        </button>
      ) : null}
      <Menu
        trigger={
          <button type="button" className={styles.iconButton} aria-label="More trip actions">
            <Icon as={MoreHorizontal} />
          </button>
        }
      >
        <MenuItem aria-label="Trip settings" onSelect={onOpenSettings}>
          Trip settings
        </MenuItem>
      </Menu>
    </header>
  );
}
