import { useId, useState, type KeyboardEvent } from 'react';
import {
  locationKey,
  tripCities,
  type Location,
  type PopularPlace,
  type TripState,
} from '@cellar/core';
import type { Dispatch } from '../grid/PlacementChip';
import { Button } from '../ui/Button';
import { PopularCard } from './PopularCard';
import { LocationDialog } from '../weather/LocationDialog';
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

const SEARCH = '__search__';

// Cities the traveler searched for, and the current choice, per trip for this session only.
interface CityChoice {
  added: Location[];
  chosenKey: string | null;
}
const sessionCities = new Map<string, CityChoice>();

/** Test helper: forgets the session's added cities and choices. */
export function forgetPopularCities(): void {
  sessionCities.clear();
}

function useCityChoice(tripId: string): [CityChoice, (next: CityChoice) => void] {
  const [choice, setChoice] = useState<CityChoice>(
    () => sessionCities.get(tripId) ?? { added: [], chosenKey: null },
  );
  const update = (next: CityChoice) => {
    sessionCities.set(tripId, next);
    setChoice(next);
  };
  return [choice, update];
}

interface Props {
  state: TripState;
  dispatch: Dispatch;
  /** Opens the trip location dialog. */
  onSetLocation: () => void;
  /** Called after a card is added to the traveler's list. */
  onAddedToList?: (name: string) => void;
}

/**
 * Well-known things to do and places to eat. The City dropdown lists the trip's cities, then
 * any searched city; its last option, "Search for city…", asks for a city and adds it.
 */
export function PopularTab({ state, dispatch, onSetLocation, onAddedToList }: Props) {
  const [choice, setChoice] = useCityChoice(state.trip.id);
  const [searching, setSearching] = useState(false);
  const cities = [...tripCities(state)];
  for (const c of choice.added) {
    if (!cities.some((t) => locationKey(t) === locationKey(c))) cities.push(c);
  }
  const city = cities.find((c) => locationKey(c) === choice.chosenKey) ?? cities[0] ?? null;
  const addCity = (next: Location) => {
    const known = cities.some((c) => locationKey(c) === locationKey(next));
    setChoice({
      added: known ? choice.added : [...choice.added, next],
      chosenKey: locationKey(next),
    });
  };
  const searchDialog = searching ? (
    <LocationDialog
      title="Search for a city"
      current={null}
      onSelect={addCity}
      onClose={() => setSearching(false)}
    />
  ) : null;
  const { list, status } = usePopularPlaces(city);
  const [group, setGroup] = useState<Group>('todo');
  const idBase = useId();
  const tabId = (g: Group) => `${idBase}-tab-${g}`;

  if (!city) {
    return (
      <div className={styles.tab}>
        <p className={styles.note}>
          Set where this trip is, or search for a city, to see popular places
        </p>
        <div className={styles.noCity}>
          <Button onClick={onSetLocation}>Set trip location</Button>
          <Button onClick={() => setSearching(true)}>Search for a city</Button>
        </div>
        {searchDialog}
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
      <label className={styles.city}>
        City
        <select
          className={styles.select}
          value={locationKey(city)}
          onChange={(e) => {
            if (e.target.value === SEARCH) setSearching(true);
            else setChoice({ ...choice, chosenKey: e.target.value });
          }}
        >
          {cities.map((c) => (
            <option key={locationKey(c)} value={locationKey(c)}>
              {c.name}
            </option>
          ))}
          <option value={SEARCH}>Search for city…</option>
        </select>
      </label>
      {searchDialog}
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
                  className={`${styles.groupTab} ${group === g.id ? styles.groupTabActive : ''} ${g.id === 'food' ? styles.food : ''}`}
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
                      onAddedToList={onAddedToList}
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
