import { useState } from 'react';
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

  if (!city) {
    return (
      <div className={styles.tab}>
        <p className={styles.note}>Set where this trip is to see popular places</p>
        <Button onClick={onSetLocation}>Set trip location</Button>
      </div>
    );
  }

  const group = (title: string, places: PopularPlace[], type: 'activity' | 'food') => (
    <section className={styles.group} aria-labelledby={`popular-${type}`}>
      <h3 className={styles.heading} id={`popular-${type}`}>
        {title}
      </h3>
      {places.length === 0 ? (
        <p className={styles.note}>No popular places found</p>
      ) : (
        <ul className={styles.list}>
          {places.map((place) => (
            <PopularCard
              key={place.placeId}
              state={state}
              place={place}
              type={type}
              dispatch={dispatch}
            />
          ))}
        </ul>
      )}
    </section>
  );

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
            {group('Things to do', list.todo, 'activity')}
            {group('Food', list.food, 'food')}
          </>
        )
      ) : null}
      {list ? (
        <p className={styles.source}>Popular on Google · {fetchedTime(list.fetchedAt)}</p>
      ) : null}
    </div>
  );
}
