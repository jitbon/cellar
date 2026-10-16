import { useEffect, useState } from 'react';
import type { CityPhoto, Trip } from '@cellar/core';
import { useCityPhotos } from './services';

export interface CityPhotoState {
  photo: CityPhoto | null;
  /** `none`: no location, no photo, or the service failed (show the placeholder). */
  status: 'loading' | 'ready' | 'none';
}

/**
 * The photo for a trip: the cover the traveler chose, else the city's lead photo. A chosen cover
 * that is gone falls back to the lead photo. Never throws; any failure means `none`.
 */
export function useCityPhoto(trip: Pick<Trip, 'locationName' | 'coverPhoto'>): CityPhotoState {
  const service = useCityPhotos();
  const { locationName, coverPhoto } = trip;
  const key = `${locationName ?? ''}\n${coverPhoto ?? ''}`;
  const [outcome, setOutcome] = useState<{ key: string; photo: CityPhoto | null } | null>(null);

  useEffect(() => {
    if (!service || !locationName) return;
    let active = true;
    const find = async () =>
      (coverPhoto ? await service.byFile(coverPhoto) : null) ?? (await service.lead(locationName));
    find().then(
      (photo) => active && setOutcome({ key, photo }),
      () => active && setOutcome({ key, photo: null }),
    );
    return () => {
      active = false;
    };
  }, [service, locationName, coverPhoto, key]);

  if (!service || !locationName) return { photo: null, status: 'none' };
  if (outcome?.key !== key) return { photo: null, status: 'loading' };
  return outcome.photo
    ? { photo: outcome.photo, status: 'ready' }
    : { photo: null, status: 'none' };
}
