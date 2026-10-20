# Setup and deploy checklist

What the project owner does by hand: hosted Supabase, Google Cloud, sign-in providers, and the
steps to repeat after each release. Each integration's background (what is sent, costs, terms)
is in the [README](README.md#integrations); test scenarios are in the `specs/*/quickstart.md`
files linked below.

`<project-ref>` is your Supabase project id and `<your-domain>` the address the web app is served
from (for example `https://cellar.example`).

## Still to do (as of 2026-10-20)

Tick these off once; afterwards only [After each release](#after-each-release) applies.

- [ ] **Link the CLI** to the hosted project (once per machine): `supabase link --project-ref <project-ref>`
- [ ] **Apply database migrations**: `supabase db push`. Pending since the last push:
      `0009_cover_photo.sql`, `0010_banner_photo.sql` (and any earlier ones if never pushed;
      the command only applies what is missing).
- [ ] **Function secrets**:
      `supabase secrets set GOOGLE_PLACES_API_KEY=<server key>` (if not set yet) and
      `supabase secrets set ALLOWED_ORIGINS=<your-domain>` (comma-separate several origins).
- [ ] **Deploy the places function**: `supabase functions deploy places`. It now has the
      `photo` and `info` actions (trip photos, place details with hours and website).
- [ ] **Google Cloud daily quota caps** (APIs & Services → Places API (New) → Quotas), as a cost
      backstop:

  | Quota         | Suggested cap per day | Used by                                           |
  | ------------- | --------------------- | ------------------------------------------------- |
  | Autocomplete  | 1,000                 | suggestions while typing                          |
  | Place Details | **100** (was 300)     | picking a suggestion, and every place detail view |
  | Text Search   | 100                   | the Popular tab                                   |
  | Place Photos  | 60                    | Popular thumbnails and detail photos              |

- [ ] **Auth URL configuration** (Supabase dashboard → Authentication → URL Configuration):
      Site URL `<your-domain>`; Redirect URLs include `<your-domain>/auth/callback` and
      `<your-domain>/reset-password`. Keep **Confirm email** on (Authentication → Providers →
      Email): account linking and the unconfirmed sign-up protection rely on it.
- [ ] **Sign-in providers**, when you want them ([below](#sign-in-with-google-apple-and-facebook)).
      Until a provider is enabled its button stays hidden, so this can wait.

## After each release

| If the release changed | Run                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/` | `supabase db push`                                                                                               |
| `supabase/functions/`  | `supabase functions deploy places`                                                                               |
| `apps/web/`            | rebuild and redeploy the web app with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set to the hosted project |
| Supabase Auth upgraded | repeat sign-in scenarios 6–7 in [specs/011-social-sign-in/quickstart.md](specs/011-social-sign-in/quickstart.md) |

Locally: new migrations go in with `supabase migration up --local` (no reset), and a changed
function needs `supabase functions serve places --env-file supabase/functions/.env` restarted.

## Sign in with Google, Apple and Facebook

Each provider needs its own developer app. All of them use the same callback address,
`https://<project-ref>.supabase.co/auth/v1/callback` (locally
`http://127.0.0.1:54321/auth/v1/callback`). Cellar asks only for the standard sign-in permissions.

### Google (free, minutes)

1. Google Cloud → APIs & Services → OAuth consent screen: app name, support email, scopes
   `email`, `profile`, `openid`; publish the app (or add yourself as a test user while testing).
2. Credentials → Create credentials → OAuth client ID → Web application. Authorized redirect URI:
   the callback address above. Copy the client ID and secret.
3. Supabase dashboard → Authentication → Providers → Google: enable, paste ID and secret.

### Apple (needs the paid Apple Developer Program)

1. Certificates, Identifiers & Profiles → Identifiers: an App ID with **Sign in with Apple**, then
   a **Services ID** (this is the client ID) with Sign in with Apple configured: domain
   `<project-ref>.supabase.co`, return URL the callback address above.
2. Keys → create a key with Sign in with Apple; download the `.p8` and note the Key ID and your
   Team ID.
3. Generate the client secret (a signed token) from those, for example with the generator linked
   in Supabase's Apple guide, and paste Services ID and secret into Authentication → Providers →
   Apple.
4. **The secret expires after six months.** Put a reminder in your calendar to regenerate it;
   when it lapses, Apple sign-in fails with "Couldn't sign in with Apple" and the other methods
   keep working.

### Facebook (needs Meta app review to go public)

1. developers.facebook.com → Create app → add **Facebook Login**. Valid OAuth redirect URI: the
   callback address above. Copy the App ID and App secret.
2. Supabase dashboard → Authentication → Providers → Facebook: enable, paste them.
3. Until Meta approves the `email` permission (app review and business verification, days to
   weeks), only people listed as app testers can sign in; others see the "didn't share an email"
   message.

### Turning providers on locally

1. Put the keys in `supabase/.env` (gitignored):
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=…`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=…` (same
   pattern for `APPLE` and `FACEBOOK`), and add the local callback address in each provider
   console.
2. Set `enabled = true` for those providers in `supabase/config.toml` (the CLI cannot read this
   switch from `.env`; don't commit the change).
3. Restart the local stack: `supabase stop && supabase start` (data is kept).
4. Check with the scenarios in
   [specs/011-social-sign-in/quickstart.md](specs/011-social-sign-in/quickstart.md).

## Checking it worked

- Sign-in providers on: `curl -s https://<project-ref>.supabase.co/auth/v1/settings -H "apikey: <anon key>"`
  lists `google`, `apple`, `facebook` as `true` for the ones you enabled.
- Places: in the app, type a place name in a cell (suggestions appear), open the Popular tab, and
  open "View details" on a linked item (hours and website show).
- Scenario lists: [004 map locations](specs/004-map-locations/quickstart.md),
  [006 popular places](specs/006-popular-places/quickstart.md),
  [007 trip photos](specs/007-trip-photos/quickstart.md),
  [011 social sign-in](specs/011-social-sign-in/quickstart.md),
  [012 place details](specs/012-linked-place-details/quickstart.md).
