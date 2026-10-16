# Research: Trip Photos

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1. City photos: source and credits

- **Decision**: Wikipedia / Wikimedia Commons through the public MediaWiki API, called from the
  browser (`origin=*`, no key):
  - **Lead photo**: `en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=<city
    name>&gsrlimit=1&prop=pageimages&piprop=name` → the article's lead image file name.
  - **More photos (cover picker)**: `generator=images&titles=<article>&gimlimit=50` on the same
    article, then keep JPEG/PNG photos at least 1000 px wide and landscape, dropping files whose
    names contain map, flag, logo, seal, coat, locator, svg; first 6.
  - **Image and credit**: `commons.wikimedia.org/w/api.php?action=query&titles=File:<name>&
    prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1280` → a 1280 px image URL plus
    `Artist` (HTML, stripped to text), `LicenseShortName`, `LicenseUrl`, and the file page URL.
  - Requests send an `Api-User-Agent: Cellar/1.0` header per Wikimedia's etiquette.
- **Credit shown**: "Photo: <Artist> · <License>" linking to the file page (CC licenses require
  author, license and a link).
- **Caching**: City photo metadata (file name, image URL, credit) is cached per device for 7 days
  via the existing `KeyValueStore`; Commons content is openly licensed, so this is allowed.
  Constitution IV's "cached and labeled" is met by the cache plus the credit line.
- **Ambiguity**: the search uses the trip location's full name ("Kyoto, Japan"), so "Paris,
  Texas" finds the Texas article.
- **Alternatives considered**: Unsplash (rejected: key, rate limits, separate terms); Google
  photos for cities (rejected: paid per photo and no storing allowed, while city photos show on
  every visit to "Your trips").

## R2. Place photos: source, cost and terms

- **Decision**: Google Places API (New) photos:
  1. Add `places.photos` to the Text Search field mask from feature 006. That request is already
     billed at the Enterprise tier, so the photo names come with no extra charge.
  2. A new `photo` action on the `places` Edge Function calls
     `GET https://places.googleapis.com/v1/<photo name>/media?maxWidthPx=<n>&skipHttpRedirect=true`
     with the key and returns `{ photoUri }`, which the browser loads directly (no key needed).
- **Cost**: "Place Details Photos" is an Enterprise SKU: 1,000 free per month, then $7.00 per
  1,000 ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)). Thumbnails
  load only for cards in view (about 6–8 per city) and one large photo per detail view, so
  ~110 Popular visits a month stay free. README gains a daily quota cap of ~60 on Place Photos.
- **Terms**: "You cannot cache a photo name. Also, the name can expire"
  ([Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos)).
  Photo names live only inside the session-memory Popular list (feature 006) and photo URIs are
  never stored. An expired name returns an error → placeholder.
- **Attribution**: "you must include the additional attribution in your application wherever you
  display the image" (`authorAttributions`). Thumbnails: each card's photo has a tooltip and
  accessible name "Photo: <author>", and the Popular list footer lists "Photos: <authors of the
  photos shown>" with links. Detail view: "Photo: <author>" over the photo, linked.
- **Alternatives considered**: Wikimedia for places (rejected in Clarifications: most
  restaurants have no image); proxying image bytes through the function (rejected: bandwidth
  through the function for no gain, since `photoUri` needs no key).

## R3. Lazy loading thumbnails

- **Decision**: An `IntersectionObserver` per Popular card (root = the panel's scroll area,
  `rootMargin: 100px`). A card requests its photo the first time it is in view; results are
  kept in session memory by photo name so re-renders and tab switches don't refetch.
- **Rationale**: Meets SC-003 (only visible cards) without a library.

## R4. Cover photo choice

- **Decision**: New nullable column `trips.cover_photo` (Commons file name, 1–300 chars). Core
  command `setTripCoverPhoto(file | null)`; `setTripLocation` clears `coverPhoto` whenever the
  location actually changes (FR-002a). Saved, synced and undone through the existing pipeline.
- **Rationale**: Storing only the file name is tiny and is all we need to rebuild the URL and
  credit via R1.

## R5. Trip status and "today"

- **Decision**: Pure core queries:
  - `tripToday(state, now)`: today's date in the trip location's time zone (feature 002's
    `todayIn`), else the device's.
  - `tripStatus(trip, today)`: `{ kind: 'before', days }` | `{ kind: 'during', day, of }` |
    `{ kind: 'after' }` → pill text "In 12 days" / "Day 2 of 5" / "Ended" (also used in the
    banner).
- The grid highlights today's day header with an accent background and a "Today" text label.

## R6. Banner visibility

- **Decision**: `KeyValueStore` key `cellar.banner.hidden` = `"1"` when hidden (per device, all
  trips). Toggled from the trip menu ("Hide city banner" / "Show city banner"). Banner height
  84 px desktop, 56 px under 640 px width; space is reserved while the photo loads (FR-010).

## R7. Detail view

- **Decision**: A `PlaceDetail` dialog using the shared `Dialog` with a new optional
  `closeOnBackdrop` prop (default off, so existing form dialogs keep their behavior). Opened by
  clicking the card body (dnd-kit's 5 px activation distance means a drag never counts as a
  click) or by a real `<button>` on the card name for keyboard users. Actions reuse the card's
  existing handlers. "Planned:" lines come from a core query `placementsOfPlace(state,
  placeId)` → `[{ date, blockName }]`.

## R8. Testing

- Core (Vitest): `tripStatus`, `tripToday`, `setTripCoverPhoto`, location change clears the
  cover, `placementsOfPlace`.
- Web (Vitest): Wikimedia adapter with mocked fetch (search → file → imageinfo, filtering,
  credit stripping, cache), place photo adapter, trip card states, banner and its toggle,
  lazy thumbnails (mocked IntersectionObserver), detail dialog.
- Edge handler (Vitest): `photo` action shape, name validation, errors; `popular` now returns
  photo names and attributions.
- DB (Vitest): `cover_photo` constraint.
- E2E (Playwright): Wikimedia and `places` mocked; cards, banner hide/show, today highlight,
  cover picker, thumbnails only in view, detail view; axe light/dark; 360 px.
