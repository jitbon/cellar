import { useEffect, useState } from 'react';
import type { CityPhoto } from '@cellar/core';
import { useCityPhotos } from './services';

export interface CityPhotoState {
  photo: CityPhoto | null;
  /** `none`: no location, no photo, or the service failed (show the placeholder). */
  status: 'loading' | 'ready' | 'none';
}

/**
 * A city photo: the one the traveler chose (`chosen`: the trip's cover photo for the card, its
 * banner photo for the trip page), else the city's lead photo. A chosen photo that is gone falls
 * back to the lead photo. Never throws; any failure means `none`.
 */
export function useCityPhoto(locationName: string | null, chosen: string | null): CityPhotoState {
  const service = useCityPhotos();
  const key = `${locationName ?? ''}\n${chosen ?? ''}`;
  const [outcome, setOutcome] = useState<{ key: string; photo: CityPhoto | null } | null>(null);

  useEffect(() => {
    if (!service || !locationName) return;
    let active = true;
    const find = async () =>
      (chosen ? await service.byFile(chosen) : null) ?? (await service.lead(locationName));
    find().then(
      (photo) => active && setOutcome({ key, photo }),
      () => active && setOutcome({ key, photo: null }),
    );
    return () => {
      active = false;
    };
  }, [service, locationName, chosen, key]);

  if (!service || !locationName) return { photo: null, status: 'none' };
  if (outcome?.key !== key) return { photo: null, status: 'loading' };
  return outcome.photo
    ? { photo: outcome.photo, status: 'ready' }
    : { photo: null, status: 'none' };
}
