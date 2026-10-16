import {
  placementsOfPlace,
  popularToPlace,
  type ISODate,
  type ItemType,
  type PopularPlace,
  type TripState,
} from '@cellar/core';
import { usePlacePhoto } from '../../state/usePlacePhoto';
import { TYPE_ICON } from '../grid/PlacementChip';
import { OpenInMapsItems } from '../places/OpenInMapsItems';
import { PhotoCredit } from '../photos/PhotoCredit';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon, Star } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import { ratingText } from './rating';
import styles from './PlaceDetail.module.css';

/** Width requested for the large photo. */
const PHOTO_WIDTH_PX = 800;

interface Props {
  state: TripState;
  place: PopularPlace;
  type: ItemType;
  /** Same as the card menu's "Place in a block" and "Add to my list". */
  onPlace: () => void;
  onAddToList: () => void;
  onClose: () => void;
}

/** "Mon May 3" */
function plannedDate(date: ISODate): string {
  const at = new Date(`${date}T12:00:00Z`);
  const weekday = at.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
  const day = at.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${weekday} ${day}`;
}

/** A popular place in detail: big photo with credit, facts, where it is planned, and actions. */
export function PlaceDetail({ state, place, type, onPlace, onAddToList, onClose }: Props) {
  const photo = usePlacePhoto(place.photo, PHOTO_WIDTH_PX);
  const meta = [place.kind, place.address].filter(Boolean).join(' · ');
  const rating = ratingText(place);
  const planned = placementsOfPlace(state, place.placeId);

  return (
    <Dialog title={place.name} closeOnBackdrop onClose={onClose}>
      <div className={styles.body}>
        {/* 16:9 is reserved up front, so the dialog does not jump when the photo arrives. */}
        <div className={styles.photo} ref={photo.ref}>
          {photo.url ? (
            <>
              <img className={styles.image} src={photo.url} alt={place.name} />
              {place.photo ? (
                <div className={styles.credit}>
                  <PhotoCredit
                    credit={place.photo.author}
                    href={place.photo.authorUri}
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
        </div>
        {planned.length > 0 ? (
          <ul className={styles.planned}>
            {planned.map((p, i) => (
              <li key={`${p.date}-${p.blockName}-${i}`}>
                Planned: {plannedDate(p.date)} · {p.blockName}
              </li>
            ))}
          </ul>
        ) : null}
        <div className={styles.actions}>
          <Button variant="primary" onClick={onPlace}>
            Place in a block
          </Button>
          <Button onClick={onAddToList}>Add to my list</Button>
          <Menu trigger={<Button>Open in maps</Button>}>
            <OpenInMapsItems place={popularToPlace(place)} />
          </Menu>
        </div>
      </div>
    </Dialog>
  );
}
