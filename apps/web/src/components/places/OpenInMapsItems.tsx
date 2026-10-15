import { mapLinks, orderMapApps, type MapApp, type Place } from '@cellar/core';
import { useKeyValueStore } from '../../state/services';
import { MenuItem, MenuLabel } from '../ui/Menu';

const STORE_KEY = 'cellar.mapApp';
const LABEL: Record<MapApp, string> = {
  google: 'Google Maps',
  apple: 'Apple Maps',
  waze: 'Waze',
};

const isMapApp = (v: string | null): v is MapApp => v === 'google' || v === 'apple' || v === 'waze';

/** Menu group that opens a linked place in a map app; the last choice is listed first. */
export function OpenInMapsItems({ place }: { place: Place }) {
  const store = useKeyValueStore();
  const stored = store?.get(STORE_KEY) ?? null;
  const links = mapLinks(place);

  return (
    <>
      <MenuLabel>Open in maps</MenuLabel>
      {orderMapApps(isMapApp(stored) ? stored : null).map((app) => (
        <MenuItem
          key={app}
          onSelect={() => {
            store?.set(STORE_KEY, app);
            window.open(links[app], '_blank', 'noopener,noreferrer');
          }}
        >
          {LABEL[app]}
        </MenuItem>
      ))}
    </>
  );
}
