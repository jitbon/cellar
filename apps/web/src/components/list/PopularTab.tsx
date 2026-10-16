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
import { LocationPicker } from '../weather/LocationPicker';
import { useWeatherService } from '../../state/services';
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
  /** Called after a card is added to the traveler's list. */
  onAddedToList?: (name: string) => void;
}

/**
 * Well-known things to do and places to eat. Starts on the trip's city; the traveler can search
 * any other city (the trip's other cities are offered as quick picks).
 */
export function PopularTab({ state, dispatch, onSetLocation, onAddedToList }: Props) {
  const weather = useWeatherService();
  const cities = tripCities(state);
  const [chosen, setChosen] = useState<Location | null>(null);
  const [changing, setChanging] = useState(false);
  const city = chosen ?? cities[0] ?? null;
  const choose = (next: Location) => {
    setChosen(next);
    setChanging(false);
  };
  const { list, status } = usePopularPlaces(city);
  const [group, setGroup] = useState<Group>('todo');
  const idBase = useId();
  const tabId = (g: Group) => `${idBase}-tab-${g}`;

  if (!city) {
    return (
      <div className={styles.tab}>
        <p className={styles.note}>
          Search for a city, or set where this trip is, to see popular places
        </p>
        {weather ? (
          <LocationPicker service={weather} onSelect={choose} label="Search for a city" />
        ) : null}
        <Button className={styles.setTrip} onClick={onSetLocation}>
          Set trip location
        </Button>
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
  const otherCities = cities.filter((c) => locationKey(c) !== locationKey(city));
  const places: PopularPlace[] = list ? list[group] : [];

  return (
    <div className={styles.tab}>
      {changing ? (
        <div className={styles.cityChange}>
          {weather ? (
            <LocationPicker
              service={weather}
              onSelect={choose}
              label="Search for a city"
              autoFocus
            />
          ) : null}
          {otherCities.length > 0 ? (
            <div className={styles.quickPicks} role="group" aria-label="Trip cities">
              {otherCities.map((c) => (
                <Button key={locationKey(c)} onClick={() => choose(c)}>
                  {c.name}
                </Button>
              ))}
            </div>
          ) : null}
          <Button variant="ghost" className={styles.cancel} onClick={() => setChanging(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className={styles.cityRow}>
          <span className={styles.cityLabel}>City</span>
          <span className={styles.cityName}>{city.name}</span>
          <Button variant="ghost" aria-label="Change city" onClick={() => setChanging(true)}>
            Change
          </Button>
        </div>
      )}
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
