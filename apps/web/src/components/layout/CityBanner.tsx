import { useEffect } from 'react';
import { tripStatus, tripStatusLabel, tripToday, type TripState } from '@cellar/core';
import { useBannerHidden } from '../../state/useBannerHidden';
import { useCityPhoto } from '../../state/useCityPhoto';
import { PhotoCredit } from '../photos/PhotoCredit';
import styles from './CityBanner.module.css';

/**
 * A short faded photo of the trip's city under the header, with the city, progress and credit.
 * Its height is reserved while the photo loads; with no location, no photo or when the traveler
 * hid it (per device), nothing is shown.
 */
export function CityBanner({
  state,
  onShownChange,
}: {
  state: TripState;
  /** Tells the page whether the banner takes height, so the grid below can make room. */
  onShownChange?: (shown: boolean) => void;
}) {
  const { trip } = state;
  const { hidden } = useBannerHidden();
  // `useCityPhoto` asks for nothing without a location; a hidden banner must not ask either.
  const { photo, status } = useCityPhoto(hidden ? { ...trip, locationName: null } : trip);
  const shown = !(hidden || !trip.locationName || status === 'none');
  useEffect(() => {
    onShownChange?.(shown);
    return () => onShownChange?.(false);
  }, [shown, onShownChange]);
  if (!shown) return null;

  const label = tripStatusLabel(tripStatus(trip, tripToday(state, new Date())));
  return (
    <div className={styles.banner} data-testid="city-banner">
      {photo ? (
        <>
          <img className={styles.image} src={photo.url} alt="" />
          <div className={styles.overlay}>
            <div className={styles.text}>
              <span className={styles.city}>{trip.locationName}</span>
              <span className={styles.status}>{label}</span>
            </div>
            <PhotoCredit
              credit={photo.credit}
              license={photo.license}
              href={photo.sourceUrl}
              variant="onPhoto"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
