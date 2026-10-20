# RealityChain — architecture

RealityChain is an on-demand home-services app for two roles, **customers** and
**pros**, built with Expo Router and React Native (web included). A booking moves
through a verified lifecycle: match → quote → arrival PIN → work → payment →
rating, with every step written to a shared timeline ("Reality Record").

This document is the map of the codebase: what each layer does, how state moves
between devices, and where the tricky invariants live.

---

## 1. Stack

| Concern | Choice |
| --- | --- |
| Runtime | Expo SDK 57, React Native 0.86, React 19 |
| Navigation | `expo-router` (file-based, typed routes, stack + tab shell) |
| Language | TypeScript, `strict` |
| Storage | `@react-native-async-storage/async-storage` on device; MongoDB via Express on the server (in-memory fallback) |
| Maps | CARTO/OSM raster tiles inside `react-native-webview` (native) or an `<iframe>` (web) |
| Icons | `@expo/vector-icons` (Ionicons) |
| Location | `expo-location` + Nominatim for web/fallback geocoding |
| Tests | Jest + `jest-expo` + React Native Testing Library; `node:test` for the server |
| Brand assets | Generated locally by `scripts/generate-brand-assets.js` |

Commands:

```
npm start              # Expo dev server
npm run web            # web target
npm run server         # API on :5000
npm run test:all       # typecheck + app tests + server tests
npm run brand          # regenerate icon/splash/favicon
```

---

## 2. Running providers

`app/_layout.tsx` wraps every screen in this order (outermost first):

```
SafeAreaProvider
└── EventProvider          // "Reality Record" timelines (src/store/events.tsx)
    └── MarketplaceProvider// profiles, jobs, bids, quotes (src/marketplace.tsx)
        └── LocationProvider// GPS + reverse geocoding (src/location-sync.tsx)
            └── ToastProvider
                └── <Stack> + SplashScreenOverlay
```

* **EventProvider** owns `RealityEvent[]` (id, title, status, timeline items).
  Items are `Photo | Note | Location | Message | Action | Verification`. Every
  meaningful booking event appends here, so the record is the audit trail.
* **MarketplaceProvider** is the single source of truth for the signed-in
  `profile`, the public job `pool`, and all mutations (`request`, `acceptJob`,
  `submitProBid`, `acceptProBid`, `advance`, `markPaid`, `rate`, `cancelJob`,
  `applyLocation`, `setManualAddress`). Screens never write storage directly.
* **LocationProvider** keeps `profile.liveLat/liveLng` fresh and exposes
  `useLocationStatus()` → `{ state: 'idle'|'locating'|'ok'|'error', error, refresh }`.
  It performs one accurate fix on sign-in/resume, then a live watch. Auto updates
  never overwrite an address the user typed (`addressSource: 'manual'`).

---

## 3. Repository map

```
app/                        # routes (expo-router)
  _layout.tsx               # providers, stack config, splash, OTA + notifications
  index.tsx                 # customer home: location header, categories, active jobs
  welcome.tsx               # role choice / first run
  login.tsx                 # phone + OTP
  request.tsx               # service request form, optional budget, dispatch
  bookings.tsx              # active/past bookings (both roles)
  records.tsx               # Reality Record timeline list
  profile.tsx               # account: identity, location card, role-only sections
  about.tsx                 # role-only "how RealityChain works" walkthrough
  pro.tsx                   # pro dashboard: online toggle, open jobs, pass, earnings
  job/[id].tsx              # live job: map, stage track, PIN, bids, pay, rate
  event/[id].tsx            # single record timeline
  new-event.tsx             # start a new record
src/
  types.ts                  # domain types + stage order/rank/normalise
  db.ts                     # AsyncStorage + API client, mergeJobs
  marketplace.tsx           # provider: profiles, jobs, bids, lifecycle rules
  matching.ts               # price/distance/ETA matching, nearbyPros
  location.ts               # GPS accuracy loop, reverse geocode, haversine
  location-sync.tsx         # LocationProvider / useLocationStatus
  location-card.tsx         # profile card with tap-to-locate
  location-modal.tsx        # manual address / saved place / GPS sheet
  permissions.ts            # camera, photo library, location wrappers
  auth.ts                   # OTP (demo or server mode)
  payment.tsx               # UPI / cash receipt modal
  sos.tsx                   # emergency sheet
  nearby-map.tsx            # live map of nearby pros / assigned pro
  dispatch-modal.tsx        # choose a pro from the map
  pass-sheet.tsx            # pro subscription ("pass") purchase
  assistant/knowledge.ts    # symptom knowledge base + intents
  assistant/engine.ts       # classifier, scorer, reply builder
  ai.ts                     # public re-export of the assistant
  ai-chat.tsx               # assistant sheet UI
  banner.tsx                # looping MP4 banner (home, bookings, records)
  remote-config.ts          # defaults, validation, cache + /api/config client
  notification-events.ts    # pure job -> notification rules
  notification-bridge.ts    # permission, local schedule, push token, deep link
  notifications-provider.tsx# watches the signed-in account's jobs
  updates.ts                # expo-updates bridge + auto-apply on launch
  version.ts                # version name/code, runtime, OTA label
  ui.tsx                    # design tokens + primitives (global icon scale)
  brand.tsx, logo.tsx, splash.tsx
  format.ts, navigation.tsx, sheet.tsx, swipe-button.tsx, toast.tsx
server/
  index.js                  # Express API (auth, jobs, bids, pros, AI, config, push)
  server.test.js            # node:test suite
__tests__/                  # app tests (logic, marketplace, location, assistant)
docs/ARCHITECTURE.md        # this file
scripts/                    # brand asset generation/preview
```

---

## 4. Data model

Defined in `src/types.ts`.

```ts
UserProfile = CustomerProfile | ProProfile
  both: name, phone, role, address, savedPlaces, avatarUri,
        locationName, liveLat, liveLng, locationAccuracy,
        locationUpdatedAt, addressSource ('gps' | 'manual')

CustomerProfile: emergencyContacts, preferredPayment, quietServicePref, ratingScore
ProProfile:      skills, isOnline, serviceRadiusKm, gpsEnabled, vehicleInfo,
                 certificateUri/idProofUri, payoutUpi, bankName, accountNumber, ifscCode,
                 proLevel, completedJobsCount,
                 freeAcceptsRemaining, monthlyFreeAcceptsRemaining,
                 subscriptionActive, passType, passExpiresAt,
                 aadhaarVerified, aadhaarMasked, customServices

ServiceJob
  id, eventId, title, kind, detail, urgency ('Standard'|'Urgent'),
  budget (customer's optional suggestion), estimate (0 until both sides agree),
  stage, customerPhone/customerName, preferredProPhone/Name,
  proName/proPhone, proUpi, eta, arrivalPin (only after agreement),
  lat/lng (where the work is), proLat/proLng/proLocationAt (live position),
  distanceKm, distanceFee, timeFee, imageUri,
  complexityMultiplier, workDurationEst, baseMarketRate,
  aiLaborCost, aiPartsCost, startedWorkAt, completedWorkAt, actualDurationFormatted,
  bids: ProBid[], hasBids, lastBidAmount, declinedPhones,
  stageTimes: Partial<Record<JobStage, string>>,
  paidAt, paymentMethod, paymentRef,
  rating, ratingComment, cancelledAt
```

Storage keys are versioned and phone-scoped (`src/db.ts`):
`rc_user_<phone>_<profile|jobs|events|sos|ai_chat>_v7`, plus shared keys
`rc_shared_marketplace_jobs_v7` and `rc_global_registered_pros_v7`.

---

## 5. Job lifecycle

```
Matching ──accept quote / customer's price──▶ Assigned ──pro arrives, enters PIN──▶ On the way
        ──▶ In progress ──pro completes──▶ Completed ──customer pays + rates──▶ (closed)
Cancelled is terminal and may be reached from any active stage.
```

* `STAGE_ORDER` is the forward path; `STAGE_RANK` adds `Cancelled` at 5 and is
  used only for conflict resolution. `normaliseStage` maps legacy `'Arriving'`
  → `'Assigned'` (older builds wrote it and it used to index to `-1`).
* **No declared price**: a request has no estimate. The customer may suggest a
  `budget`; pros either quote (`ProBid.bidAmount`) or accept that budget
  (`acceptBudget`). Whichever side agrees, the agreement sets `estimate` and
  is the only moment a price exists.
* **Arrival PIN**: created at agreement (4 digits), never earlier. The customer
  shares it only on arrival; `advance(id, pin)` refuses to move
  `On the way → In progress` without it. This is the "proof the right person
  is at the door" step.
* **Bids**: a `Matching` job can collect quotes (`ProBid`), one per pro; a newer
  quote replaces an older one. Each quote carries the pro's `proUpi` so the
  booked customer can pay them directly. Customers can decline a pro
  (`declinedPhones`) and that bid will not return on sync.
* **Free accepts**: pros get `FREE_ACCEPTS = 10` accepts, then a pass
  (`subscriptionActive`) is required to keep accepting work.
* **Visibility**: jobs are scoped by phone. A pro sees open `Matching` jobs plus
  jobs assigned to them; a customer sees their own. Nobody sees another user's
  PIN or timeline.
* **Payment**: `markPaid` records method + timestamp; a UPI/cash receipt sheet
  is shown on the job screen. The UPI option builds a `upi://pay` link from the
  pro's own handle and shows it as a QR (opens PhonePe/GPay/Paytm with the
  agreed amount filled in); without a handle the sheet says so and offers cash.
  No card data is stored and the app never moves money.
* **Rating**: `rate` writes stars/comment and closes the record.

Every transition also appends a timeline item to the linked `RealityEvent`
(`Action` / `Verification`), stamped with `stageTimes`.

---

## 6. Sync and conflict resolution

There is no websocket. Each screen polls and merges:

| Screen | Cadence |
| --- | --- |
| Customer home (`app/index.tsx`) | every 10 s while signed in |
| Pro dashboard (`app/pro.tsx`) | every 10 s while online |
| Job detail (`app/job/[id].tsx`) | every 5 s while open |
| Bookings list | on mount and pull-to-refresh |

`syncGlobalJobs()` loads storage (and, when configured, `/api/jobs`) and merges
rather than replaces. `mergeJobs` (`src/db.ts`, mirrored in `server/index.js`):

* **Stage**: the further-along copy wins; tie → local copy wins. A stale phone
  can never rewind a job.
* **Bids**: union, deduped per pro by newest timestamp, minus declined pros.
* **Pro position**: whichever copy has the newest `proLocationAt` supplies
  `proLat/proLng`. This is what makes the customer's map follow the pro.
* **`stageTimes`**: union, so early timestamps survive.
* **Payment/rating**: whichever copy actually paid/rated wins (fields are only
  set once).

The server stores jobs/pros in MongoDB if `MONGODB_URI` resolves, otherwise an
in-memory map (fine for local dev, lost on restart).

### API (`server/index.js`)

```
GET  /api/health
POST /api/auth/request-otp      POST /api/auth/verify-otp
POST /api/ai                    # proxy to Grok/xAI; 503 when no key
GET  /api/jobs                  POST /api/jobs
POST /api/jobs/:id/bid          POST /api/jobs/:id/accept-bid
GET  /api/pros                  POST /api/pros
```

Phone numbers are normalised to the last 10 digits everywhere.

---

## 7. Sign-in

`src/auth.ts` has two modes:

* **demo** (default, and whenever `EXPO_PUBLIC_API_URL` is unset): no SMS, code
  is `123456`, clearly labelled in the UI.
* **server**: `EXPO_PUBLIC_AUTH_MODE=server` + `EXPO_PUBLIC_API_URL`. Codes are
  issued/verified server-side, single-use, locked after 5 wrong attempts, and
  return 503 if the SMS provider is not configured.

---

## 8. Location pipeline

This is the most delicate part of the app; it is why `src/location.ts` exists
separately from the UI.

### Fixes

`getAccurateLocation()`:

1. Requests foreground permission (`ensurePermission`).
2. Accepts a **cached** position only if it is ≤60 s old *and* within
   `requiredAccuracy` (25 m).
3. Otherwise calls `getCurrentPositionAsync({ accuracy: Highest })`.
4. Watches position and resolves early as soon as accuracy ≤ 25 m, or after
   12 s with the best fix seen. No magic defaults — a failure returns
   `{ ok: false, error: 'denied' | 'unavailable' | 'timeout' }`.

The old implementation used `Accuracy.Balanced`, accepted any cached fix, and
silently fell back to a hard-coded Bengaluru coordinate. That is the bug this
module fixes; there is **no** default coordinate in the success path.

### Addresses

`reverseGeocode(lat, lng)` uses the device geocoder on native and Nominatim on
web (expo-location's geocoder throws `GeocoderError` on web), falling back
across both. `geocodeAddress()` does the same for typed addresses, so a saved
place gets real coordinates instead of a fake pin.

### Writing locations

`applyLocation(fix, place, mode)` in the marketplace provider:

* `mode: 'auto'` — background sync. Updates `liveLat/liveLng/accuracy/
  updatedAt`; if the current address was typed by hand
  (`addressSource === 'manual'`) it is left alone.
* `mode: 'explicit'` — the user tapped the locate button. Always replaces the
  address and sets `addressSource: 'gps'`.

`setManualAddress(address, short, coords)` sets `addressSource: 'manual'` and
never gets overwritten by GPS.

### Live tracking

`LocationProvider` watches with role-specific rules:

| Role | Move threshold | `distanceInterval` | `timeInterval` |
| --- | --- | --- | --- |
| Customer | 100 m | 50 m | 30 s |
| Pro | 20 m | 15 m | 10 s |

(with `geocodeKm` re-geocode thresholds 0.25 km / 0.5 km). A pro who is online
with GPS sharing on is tracked tightly because customers watch them on the job
map. While a job is active, the pro's position is written onto the job
(`proLat/proLng/proLocationAt`) and `distanceKm`/ETA are recomputed, so the
customer's screen follows in near real time (limited by the 5 s job poll).

### Maps

`src/nearby-map.tsx` renders OSM raster tiles. It only plots pros that are
online **and** have real coordinates within `MAP_RADIUS_KM = 25`; there are no
fake pins. On native it injects `window.rcUpdatePro(...)` into the WebView; on
web it `postMessage`s to the iframe. Overlays are honest: "Waiting for X's live
location" / "Set your location to see pros near you".

### Pricing distance

`matchService(kind, urgency, imageUri, registeredPros, customerPoint)` measures
the customer→pro distance for real, ignores pros outside their
`serviceRadiusKm`, and returns `nearbyPros`. When nobody is nearby it assumes
`ASSUMED_DISTANCE_KM = 3` for its reference quote and says so. The request
screen no longer shows that quote — price is negotiated with the pro — and
pricing no longer measures from a fixed point.

---

## 9. AI assistant

Two files, intentionally separated:

* `src/assistant/knowledge.ts` — *what it knows*. ~40 symptom topics across 11
  categories (Plumbing, Electrical, AC repair, Appliance repair, Carpentry,
  Painting, Pest control, Cleaning, Computer & network, …). Each topic has
  cause, safe DIY steps, when to call a pro, parts, time, price range, safety
  note, and the bookable category. Also app-help intents (PIN, SOS, cancel,
  payment, pro pass, how it works, location, refund, safety, capabilities),
  emergency phrases, greetings/thanks/bye, and Hinglish keys
  (`nal`, `bijli`, `pankha`, `deemak`, `khatmal`, `chuha`, `kitna`, `paisa`).
* `src/assistant/engine.ts` — *how it decides*. `normalise` → `classify` →
  reply builder.

Scoring is whole-word with prefix stemming for tokens ≥4 chars
(`leak` matches `leaking`, but `ac` never matches `account` or `actually`),
deduped per token, with bonuses for phrases and category names. The classifier
checks, in order:

1. **Emergency** (gas smell, shock, fire, flooding) → safety numbers first.
2. **Topic** match (highest score above threshold).
3. **Category** match → category overview/pricing.
4. **App intent** → concrete answer about this app.
5. **Small talk** (greeting/thanks/bye).
6. **Fallback** → says it is unsure, offers suggestions instead of guessing.

`questionType` then picks the right *section* of the matched topic: price
questions get "Typical cost", DIY questions get "What you can safely try",
"why" questions get "Likely cause", and so on. Follow-ups reuse the previous
topic from context: after "my tap is dripping", "how much will it cost?" prices
the dripping tap, and "can I fix it myself?" gives its DIY steps. Every problem
reply returns `actions` (`Book <category>` → `/request` pre-filled) and
`suggestions` (tap-to-ask chips). If `EXPO_PUBLIC_API_URL` is set and the topic
score is low, `remoteReply` can consult the server's `/api/ai` proxy; local
answers always work offline.

`src/ai-chat.tsx` is the sheet UI: streaming-free thinking state, rich text,
book/suggestion chips, and a role-aware "Book" button (hidden for pros).

---

## 10. Design system

`src/ui.tsx` holds the tokens and primitives (`C` colours, `type` scale,
`radius`, `Button`, `Card`, `Chip`, `Badge`, `IconButton`, `ListRow`,
`SectionHeader`, `rupee`, `Icon`). Icons go through one `ICON_SCALE` (0.85) so
the whole app can be tuned in a single place; the customer home categories use
filled 24px source glyphs (~20px drawn) inside identical white 54px squircles
with a soft lift, and the assistant card uses 20px so the four-column grid stays
light. The palette is neutral white/ink with a green
"verified" accent (`#0E8A63`). Brand mark: a bold "R" whose leg flicks into a
check; assets are generated by `scripts/generate-brand-assets.js` (icon,
adaptive icon, splash, favicon, SVGs), so the logo never drifts between
platforms.

Motion is used to explain state, not decorate: splash fade, step connectors
growing in `about.tsx`, the pulse ring on the locate button, animated chat
bubbles, and toast transitions. `about.tsx` picks its walkthrough from
`profile.role` (no switcher), so each side only sees their own flow. The
profile photo (`avatarUri`) is drawn by `Avatar` wherever the account appears,
including the home header and the account tab.

---

## 11. Privacy and safety

* Everything customer-specific is stored per phone number; the public pool only
  contains jobs/pros that role is allowed to see.
* Arrival PINs are only visible to the customer and the assigned pro.
* Pros are stored without bank/account details server-side; payout fields stay
  on the device profile.
* SOS texts the user's saved emergency contacts with a maps link and the
  helpline number; the app states it does not contact anyone on the user's
  behalf.
* Demo auth is clearly labelled so nobody mistakes it for real SMS sign-in.
* The assistant is explicitly "general guidance — a pro confirms on site"; it
  never claims to diagnose remotely.

---

## 12. Testing

```
npm run test:all
  ├─ tsc --noEmit
  ├─ jest (__tests__/)
  └─ node --test server/server.test.js
```

Coverage focuses on the places bugs actually hurt:

* `__tests__/logic.test.ts` — stage normalisation/order, formatting, PIN rules.
* `__tests__/marketplace.test.tsx` — request → negotiate → PIN → pay → rate,
  budget acceptance, bids with UPI, visibility, pass limits, merging.
* `__tests__/location.test.tsx` — cached-fix freshness, highest accuracy,
  watch-until-target, denied/timeout produce no fake point, native→Nominatim
  geocode fallback, real-distance matching/radius, newest pro position wins,
  manual address survives auto updates but not an explicit tap.
* `__tests__/assistant.test.ts` — topic recognition on real phrasings,
  substring traps (`account`/`actually`), question-type routing, follow-up
  context, app intents, emergencies, Hinglish, fallback.
* `__tests__/remote-config.test.ts` — banner normalisation (junk audiences,
  long text, unknown tones, unsafe route/URL actions), audience/schedule
  matching and first-active pick.
* `__tests__/version.test.ts` — version name/code label, embedded vs OTA bundle
  label, short update ids.
* `__tests__/notifications.test.ts` — first-run baseline, quote/stage dedupe,
  current-stage-only history, role visibility, pro payment/rating, deep link.
* `server/server.test.js` — OTP issue/lock/single-use, job validation, stale
  phone cannot rewind, legacy stage normalisation, bids, no bank details
  stored, AI proxy auth errors, pro-location merge, `/api/config` defaults and
  env override, push registration + quote/accept delivery.

Playwright scripts (kept outside the repo, under the temp dir) drive the web
build through the full lifecycle, screenshots included, with geolocation
permission granted — useful for verifying location, the per-account home
banners, OTA/version labels, icon sizes and profile layout end to end.

---

## 13. OTA updates, versions and remote config

**Versioning.** `app.json` holds the version name (`version`, e.g. `1.0.0`),
Android `versionCode` (`1`) and iOS `buildNumber` (`1`). EAS
`autoIncrement` bumps the store build number on production builds
(`eas.json`). `runtimeVersion` uses the `appVersion` policy, so an OTA is only
delivered to builds with a compatible native layer. Both the version name and
code are shown in the About screen footer (`src/version.ts`).

**OTA (EAS Update).** `expo-updates` is installed and enabled with
`checkAutomatically: "ON_LOAD"` and `fallbackToCacheTimeout: 0`. On every launch
`autoApplyUpdate()` (from `src/updates.ts`, called in `app/_layout.tsx`) checks
for a bundle, downloads it and calls `reloadAsync()` once — so a fresh install,
reinstall, or delete-and-install picks up the newest JS before the user starts.
Updates are a no-op on web and in development. `app.config.js` lets CI supply
`EXPO_UPDATES_URL` and `EAS_PROJECT_ID` instead of editing the file; publish with
`eas update --channel production`.

What an OTA can change: every screen, flow, string, validation, local
assistant answer, banner default and business rule in `app/`/`src/`. What it
cannot change: native dependencies, permissions, icons/splash, scheme or
package ids, and `app.json` native fields — those need a new store build (and a
version bump), which is exactly what makes the runtime version meaningful.

**Remote config.** `/api/config` (server) serves a JSON document that the app
validates in `src/remote-config.ts` and caches in AsyncStorage. Override it
without any release using the `REMOTE_CONFIG_JSON` env var. The banner
(`src/banner.tsx`) is the first consumer: title, body, CTA, icon, tone, surface
(customer home, pro home, bookings, records), schedule window and action can
change server-side. Banners are permanent surfaces (no dismiss control) and
animate in with a short rise plus a gentle icon breathe and CTA-arrow nudge;
the artwork loops quietly in place without drifting. Copy and art use separate
columns - copy never sits on top of the image - so titles and body text cannot
overlap the illustration.
Each surface has a muted, looping MP4 (`assets/banners/{customer,pro,bookings,records}.mp4`)
rendered by `expo-video` in its own right-hand column with `contentFit="contain"`.
The clips are padded with ffmpeg to a 3:4 (720x960) frame and the card uses the
same encoded edge colour (customer `#E7F3EC`, pro `#F2EDE1`, bookings
`#FCF1E0`, records `#0D0E11`), so the video fills the column without a visible
letterbox or black border. The customer art is pre-cropped to 656x720 before
padding, keeping the sun and trees in frame. The video surface is removed while its screen is blurred and
the loaded player is kept alive, so a native TextureView cannot paint its
rectangle over the incoming screen. A matching first-frame PNG sits on top and
fades out only after the poster has loaded and the video's first frame has
rendered, hiding the native surface's start-up blink and cold-start edges.
Playback position is remembered per audience, so
returning to a tab resumes the ambience instead of restarting at frame zero.
Both work offline and in Expo Go; the
matching bundled banner is used if the remote config is empty. Copy can use
`{{name}}` (e.g. `Hi {{name}}, what do you need help with?`) without exposing the profile to
the config server. Remote data is treated as untrusted: only internal
routes and `http(s)` links are allowed, text is length-capped, and unknown
fields/tones/audiences are dropped.

---

## 14. Notifications

Two layers, because Expo Go cannot register remote push tokens on Android and
its current `expo-notifications` package references a native module Expo Go
does not ship (`ExpoTopicSubscriptionModule`):

* **Local (installed builds).** `src/notification-events.ts` turns job changes
  into events — a quote for the customer, the current stage change, a new open
  request for the pro, payment and rating. Keys are persisted per phone/role
  (`rc_notif_seen_v1_*`) so nothing is announced twice; the first run seeds
  current jobs silently. `src/notification-bridge.ts` asks for permission once,
  draws the foreground banner and schedules the notification; tapping it opens
  `/job/:id`. The job currently on screen is skipped.
* **Expo Go / denied permission.** The native module is never required (which
  avoids the missing-module crash); the same deduped events are shown as an
  in-app toast through `ToastProvider`. This keeps the account informed while
  developing, without pretending remote push works there.
* **Remote (development/standalone builds only).** A device registers its Expo
  push token with `POST /api/push/register`; the server stores the token in
  memory and sends through Expo's push service when a pro quotes
  (`/api/jobs/:id/bid` → customer) or a quote is accepted
  (`/api/jobs/:id/accept-bid` → pro). Delivery is best-effort and never blocks
  the API response. Expo Go on Android deliberately skips token registration;
  iOS Expo Go and installed builds use the full path.

`app.json` includes the `expo-notifications` plugin, which adds the Android
notification permission/channel setup and iOS entitlements on the next native
build. Background/terminated delivery relies on the remote path; local
notifications are produced while the app is running.

---

## 15. Known limits / next steps

* Polling (5–10 s) is used instead of push; a websocket or SSE channel would
  make pro tracking smoother.
* Location sync stops updating the job if the pro's app is backgrounded;
  customers see the last known point and the UI says so.
* The AI assistant is deterministic and offline-first; the `/api/ai` proxy is an
  optional enhancement, not a dependency.
* Web geocoding depends on Nominatim's public rate limits; production should
  use a keyed provider.
* `MONGODB_URI` is not configured in `.env` by default, so the server runs on
  its in-memory store until it is.
