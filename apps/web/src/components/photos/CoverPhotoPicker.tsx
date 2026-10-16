import { useEffect, useState } from 'react';
import type { CityPhoto } from '@cellar/core';
import { useCityPhotos } from '../../state/services';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Check, Icon } from '../ui/Icon';
import { PhotoCredit } from './PhotoCredit';
import styles from './CoverPhotoPicker.module.css';

const CHOICES = 6;

interface Props {
  cityName: string;
  /** File name of the photo showing now (chosen or automatic), marked as selected. */
  current: string | null;
  /** A file name, or null for "Use automatic photo". The dialog closes after. */
  onPick: (file: string | null) => void;
  onClose: () => void;
}

type Choices =
  { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; photos: CityPhoto[] };

/** Up to 6 photos of the trip's city to choose a cover from. */
export function CoverPhotoPicker({ cityName, current, onPick, onClose }: Props) {
  const service = useCityPhotos();
  const [choices, setChoices] = useState<Choices>({ status: 'loading' });

  useEffect(() => {
    if (!service) {
      setChoices({ status: 'unavailable' });
      return;
    }
    let active = true;
    service.more(cityName, CHOICES).then(
      (photos) => active && setChoices({ status: 'ready', photos }),
      () => active && setChoices({ status: 'unavailable' }),
    );
    return () => {
      active = false;
    };
  }, [service, cityName]);

  const pick = (file: string | null) => {
    onPick(file);
    onClose();
  };

  return (
    <Dialog title="Change cover photo" wide onClose={onClose}>
      <div className={styles.body}>
        {choices.status === 'loading' ? (
          <p role="status" className={styles.note}>
            Loading photos…
          </p>
        ) : null}
        {choices.status === 'unavailable' ? (
          <p role="status" className={styles.note}>
            Photos unavailable right now
          </p>
        ) : null}
        {choices.status === 'ready' && choices.photos.length === 0 ? (
          <p role="status" className={styles.note}>
            No photos found
          </p>
        ) : null}
        {choices.status === 'ready' && choices.photos.length > 0 ? (
          <ul className={styles.grid}>
            {choices.photos.map((photo, i) => {
              const selected = photo.file === current;
              return (
                <li key={photo.file} className={styles.choice}>
                  <button
                    type="button"
                    className={`${styles.photo} ${selected ? styles.selected : ''}`}
                    aria-label={`Photo ${i + 1} by ${photo.credit}`}
                    aria-pressed={selected}
                    onClick={() => pick(photo.file)}
                  >
                    <img src={photo.url} alt="" className={styles.image} />
                    {selected ? (
                      <span className={styles.badge}>
                        <Icon as={Check} size="small" />
                        Selected
                      </span>
                    ) : null}
                  </button>
                  <PhotoCredit
                    credit={photo.credit}
                    license={photo.license}
                    href={photo.sourceUrl}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className={styles.actions}>
          <Button onClick={() => pick(null)}>Use automatic photo</Button>
        </div>
      </div>
    </Dialog>
  );
}
