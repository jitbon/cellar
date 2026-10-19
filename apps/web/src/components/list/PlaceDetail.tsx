import type { ReactNode } from 'react';
import {
  kindLabel,
  placementsOfPlace,
  popularToPlace,
  type ISODate,
  type ItemType,
  type Place,
  type PlacePhotoRef,
  type PopularPlace,
  type TripState,
} from '@cellar/core';
import { usePlaceInfo } from '../../state/usePlaceInfo';
import { usePlacePhoto } from '../../state/usePlacePhoto';
import { TYPE_ICON } from '../grid/PlacementChip';
import { OpenInMapsItems } from '../places/OpenInMapsItems';
import { PhotoCredit } from '../photos/PhotoCredit';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon, Star } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import { PlaceHours } from './PlaceHours';
import { ratingText } from './rating';
import styles from './PlaceDetail.module.css';

/** Width requested for the large photo. */
const PHOTO_WIDTH_PX = 800;

/** What a view can show at once; the provider fills in whatever is missing. */
export interface PlaceSubject {
  placeId: string;
  name: string;
  address: string;
  /** Human-readable type, e.g. "Museum"; empty until the provider tells. */
  kind: string;
  rating: number | null;
  ratingCount: number | null;
  photo: PlacePhotoRef | null;
  /** What "Open in maps" opens. */
  place: Place;
}

/** A popular place already carries its photo, type and rating. */
export function popularSubject(p: PopularPlace): PlaceSubject {
  return {
    placeId: p.placeId,
    name: p.name,
    address: p.address,
    kind: p.kind,
    rating: p.rating,
    ratingCount: p.ratingCount,
    photo: p.photo,
    place: popularToPlace(p),
  };
}

/** A place stored with an item or event: name, address and its stored type are known up front. */
export function linkedSubject(place: Place): PlaceSubject {
  return {
    placeId: place.id,
    name: place.name,
    address: place.address,
    kind: kindLabel(place.category),
    rating: null,
    ratingCount: null,
    photo: null,
    place,
  };
}

interface Props {
  state: TripState;
  subject: PlaceSubject;
  /** Picks the icon shown while there is no photo. */
  type: ItemType;
  /** Buttons that come before "Open in maps". */
  actions: ReactNode;
  onClose: () => void;
}

/** "Mon May 3" */
function plannedDate(date: ISODate): string {
  const at = new Date(`${date}T12:00:00Z`);
  const weekday = at.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
  const day = at.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${weekday} ${day}`;
}

/**
 * A place in detail, for Popular places and for linked items and events: what is known shows at
 * once; photo, type, rating, hours and website come from the provider when the view opens.
 */
export function PlaceDetail({ state, subject, type, actions, onClose }: Props) {
  const info = usePlaceInfo(subject.placeId);
  const fetched = info.status === 'ready' ? info.info : null;
  const photoRef = subject.photo ?? fetched?.photo ?? null;
  const photo = usePlacePhoto(photoRef, PHOTO_WIDTH_PX);
  const meta = [fetched?.kind || subject.kind, subject.address].filter(Boolean).join(' · ');
  const from = subject.rating !== null ? subject : fetched;
  const rating = from ? ratingText(from) : '';
  const planned = placementsOfPlace(state, subject.placeId);

  return (
    <Dialog title={subject.name} closeOnBackdrop onClose={onClose}>
      <div className={styles.body}>
        {/* 16:9 is reserved up front, so the dialog does not jump when the photo arrives. */}
        <div className={styles.photo} ref={photo.ref}>
          {photo.url ? (
            <>
              <img className={styles.image} src={photo.url} alt={subject.name} />
              {photoRef ? (
                <div className={styles.credit}>
                  <PhotoCredit
                    credit={photoRef.author}
                    href={photoRef.authorUri}
                    variant="onPhoto"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <span className={styles.placeholder} data-testid="place-photo-placeholder">
              <Icon as={TYPE_ICON[type]} />
            </span>
          )}
        </div>
        <div className={styles.facts}>
          {meta ? <span className={styles.meta}>{meta}</span> : null}
          {rating ? (
            <span className={styles.meta}>
              <Icon as={Star} size="small" />
              <span>{rating}</span>
            </span>
          ) : null}
          {fetched ? <PlaceHours info={fetched} /> : null}
          {fetched?.website ? (
            <a className={styles.link} href={fetched.website} target="_blank" rel="noreferrer">
              Website
            </a>
          ) : null}
          {info.status === 'loading' ? (
            <p className={styles.note} role="status">
              Loading details…
            </p>
          ) : null}
          {info.status === 'unavailable' ? (
            <p className={styles.note}>More details aren&apos;t available right now.</p>
          ) : null}
          {info.status === 'not-found' ? (
            <p className={styles.note}>This place may no longer be listed.</p>
          ) : null}
        </div>
        {planned.length > 0 ? (
          <ul className={styles.planned}>
            {planned.map((p, i) => (
              <li key={`${p.date}-${p.blockName}-${i}`}>
                Planned: {plannedDate(p.date)} · {p.blockName}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.note}>Not planned yet</p>
        )}
        <div className={styles.actions}>
          {actions}
          <Menu trigger={<Button>Open in maps</Button>}>
            <OpenInMapsItems place={subject.place} />
          </Menu>
        </div>
      </div>
    </Dialog>
  );
}
