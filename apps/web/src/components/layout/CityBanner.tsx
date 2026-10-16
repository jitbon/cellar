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
  onChangePhoto,
}: {
  state: TripState;
  /** Tells the page whether the banner takes height, so the grid below can make room. */
  onShownChange?: (shown: boolean) => void;
  /** Opens the banner photo picker; the button is left out when omitted. */
  onChangePhoto?: () => void;
}) {
  const { trip } = state;
  const { hidden } = useBannerHidden();
  // `useCityPhoto` asks for nothing without a location; a hidden banner must not ask either.
  // The banner has its own photo choice, separate from the trip card's cover.
  const { photo, status } = useCityPhoto(hidden ? null : trip.locationName, trip.bannerPhoto);
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
            <div className={styles.side}>
              {onChangePhoto ? (
                <button
                  type="button"
                  className={styles.change}
                  aria-label="Change banner photo"
                  onClick={onChangePhoto}
                >
                  Change photo
                </button>
              ) : null}
              <PhotoCredit
                credit={photo.credit}
                license={photo.license}
                href={photo.sourceUrl}
                variant="onPhoto"
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
