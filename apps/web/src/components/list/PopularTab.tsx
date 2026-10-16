import { useId, useState, type KeyboardEvent } from 'react';
import { locationKey, tripCities, type PopularPlace, type TripState } from '@cellar/core';
import type { Dispatch } from '../grid/PlacementChip';
import { Button } from '../ui/Button';
import { PopularCard } from './PopularCard';
import { usePopularPlaces } from '../../state/usePopularPlaces';
import styles from './PopularTab.module.css';

function fetchedTime(fetchedAt: string): string {
  return new Date(fetchedAt).toLocaleTimeString(navigator.language, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Group = 'todo' | 'food';

const GROUPS: { id: Group; label: string; type: 'activity' | 'food' }[] = [
  { id: 'todo', label: 'Things to do', type: 'activity' },
  { id: 'food', label: 'Food', type: 'food' },
];

interface Props {
  state: TripState;
  dispatch: Dispatch;
  /** Opens the trip location dialog. */
  onSetLocation: () => void;
}

/** Well-known things to do and places to eat in the trip's city (or another city of the trip). */
export function PopularTab({ state, dispatch, onSetLocation }: Props) {
  const cities = tripCities(state);
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const city = cities.find((c) => locationKey(c) === chosenKey) ?? cities[0] ?? null;
  const { list, status } = usePopularPlaces(city);
  const [group, setGroup] = useState<Group>('todo');
  const idBase = useId();
  const tabId = (g: Group) => `${idBase}-tab-${g}`;

  if (!city) {
    return (
      <div className={styles.tab}>
        <p className={styles.note}>Set where this trip is to see popular places</p>
        <Button onClick={onSetLocation}>Set trip location</Button>
      </div>
    );
  }

  // ARIA tabs: arrow keys move between the two groups and select them.
  function onTabKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next: Group = group === 'todo' ? 'food' : 'todo';
    setGroup(next);
    document.getElementById(tabId(next))?.focus();
  }

  const current = GROUPS.find((g) => g.id === group)!;
  const places: PopularPlace[] = list ? list[group] : [];

  return (
    <div className={styles.tab}>
      {cities.length > 1 ? (
        <label className={styles.city}>
          City
          <select
            className={styles.select}
            value={locationKey(city)}
            onChange={(e) => setChosenKey(e.target.value)}
          >
            {cities.map((c) => (
              <option key={locationKey(c)} value={locationKey(c)}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {status === 'loading' ? (
        <p role="status" className={styles.note}>
          Loading popular places…
        </p>
      ) : null}
      {status === 'unavailable' ? (
        <p role="status" className={styles.note}>
          Popular places unavailable right now
        </p>
      ) : null}
      {list ? (
        list.todo.length === 0 && list.food.length === 0 ? (
          <p className={styles.note}>No popular places found</p>
        ) : (
          <>
            <div
              className={styles.groupTabs}
              role="tablist"
              aria-label="Popular groups"
              onKeyDown={onTabKeyDown}
            >
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  id={tabId(g.id)}
                  type="button"
                  role="tab"
                  aria-selected={group === g.id}
                  aria-controls={`${idBase}-panel`}
                  tabIndex={group === g.id ? 0 : -1}
                  className={`${styles.groupTab} ${group === g.id ? styles.groupTabActive : ''}`}
                  onClick={() => setGroup(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div
              id={`${idBase}-panel`}
              role="tabpanel"
              aria-labelledby={tabId(group)}
              className={styles.group}
            >
              {places.length === 0 ? (
                <p className={styles.note}>No popular places found</p>
              ) : (
                <ul className={styles.list}>
                  {places.map((place) => (
                    <PopularCard
                      key={place.placeId}
                      state={state}
                      place={place}
                      type={current.type}
                      dispatch={dispatch}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )
      ) : null}
      {list ? (
        <p className={styles.source}>Popular on Google · {fetchedTime(list.fetchedAt)}</p>
      ) : null}
    </div>
  );
}
