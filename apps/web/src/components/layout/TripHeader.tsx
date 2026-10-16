import { useRef, useState } from 'react';
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
import { useBannerHidden } from '../../state/useBannerHidden';
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
  /** Opens the banner photo picker (offered while the banner is shown). */
  onChangeBannerPhoto?: () => void;
  /** Renames the trip from the header; returns an error message, or null when saved. */
  onRename?: (name: string) => string | null;
  /** The location chip; left out while the city banner shows (and changes) the city. */
  showLocation?: boolean;
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
  onChangeBannerPhoto,
  onRename,
  showLocation = true,
  panel,
}: Props) {
  const banner = useBannerHidden();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  // Enter closes the field; the blur that may follow must not save a second time.
  const editingRef = useRef(false);

  const startRename = () => {
    setDraft(name);
    setError(null);
    editingRef.current = true;
    setEditing(true);
  };
  const stopRename = () => {
    editingRef.current = false;
    setEditing(false);
  };
  const saveRename = () => {
    if (!editingRef.current || !onRename) return;
    const next = draft.trim();
    if (next === name) return stopRename();
    const problem = onRename(next);
    if (problem) setError(problem);
    else stopRename();
  };

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.back} aria-label="Trips">
        <Icon as={ArrowLeft} />
        <span className={styles.backText}>Trips</span>
      </Link>
      <h1 className={styles.name}>
        {editing ? (
          <span className={styles.nameEdit}>
            <input
              autoFocus
              className={styles.nameInput}
              aria-label="Trip name"
              aria-invalid={error ? true : undefined}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename();
                else if (e.key === 'Escape') {
                  e.stopPropagation();
                  stopRename();
                }
              }}
            />
            {error ? (
              <span role="alert" className={styles.nameError}>
                {error}
              </span>
            ) : null}
          </span>
        ) : onRename ? (
          <button
            type="button"
            className={styles.nameButton}
            aria-label={`Rename trip (${name})`}
            onClick={startRename}
          >
            {name}
          </button>
        ) : (
          name
        )}
      </h1>
      <button
        type="button"
        className={styles.chip}
        aria-label={`Change trip dates (${rangeLabel})`}
        onClick={onEditDates}
      >
        <Icon as={CalendarDays} />
        <span className={styles.rangeText}>{rangeLabel}</span>
      </button>
      {showLocation ? (
        <button
          type="button"
          className={styles.chip}
          aria-label={locationName ? `Change trip location (${locationName})` : 'Add a location'}
          onClick={onEditLocation}
        >
          <Icon as={MapPin} />
          <span className={styles.locationText}>{locationName ?? 'Add a location'}</span>
        </button>
      ) : null}
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
        {locationName ? (
          <MenuItem onSelect={() => banner.setHidden(!banner.hidden)}>
            {banner.hidden ? 'Show city banner' : 'Hide city banner'}
          </MenuItem>
        ) : null}
        {locationName && !banner.hidden && onChangeBannerPhoto ? (
          <MenuItem onSelect={onChangeBannerPhoto}>Change banner photo</MenuItem>
        ) : null}
      </Menu>
    </header>
  );
}
