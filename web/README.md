# MustangMaps web

Static landing site that powers Universal Links for the MustangMaps iOS app.

## What's here

- `index.html` — homepage at `https://mustangmaps.vercel.app/`
- `p/index.html` — pin-share landing page at `https://mustangmaps.vercel.app/p?lat=…&lng=…&n=…`. Auto-fires the `mustangmaps://` deep link on iOS; if the app is installed and AASA has propagated, iOS will normally bypass this page entirely and open the app directly.
- `.well-known/apple-app-site-association` — declares `/p` and `/p/*` as Universal Link paths owned by the app.
- `vercel.json` — sets `Content-Type: application/json` on the AASA file (required by Apple).

## One-time setup before first deploy

1. **Replace the team ID** in `.well-known/apple-app-site-association`. Open the file and replace `__TEAM_ID__` with your Apple Developer Team ID (10 chars, find it at https://developer.apple.com/account → Membership). The `appIDs` line should end up looking like:
   ```
   "appIDs": ["A1B2C3D4E5.com.mustangmaps.app"]
   ```
2. Sign in to Vercel: `npx vercel login`

## Deploy

From `web/`:

```bash
npx vercel deploy --prod
```

First time, Vercel will ask:
- Scope → your account
- Link to existing project? → No
- Project name → `mustangmaps`
- Directory → `./` (default)
- Modify settings? → No

After it finishes you'll get a URL like `https://mustangmaps-xyz.vercel.app`. In the Vercel dashboard for the project, set the production domain to `mustangmaps.vercel.app` (Settings → Domains → Add → `mustangmaps.vercel.app`). That's the domain the app's `associatedDomains` is pointed at.

## Verify

```bash
# Should return JSON with Content-Type: application/json
curl -I https://mustangmaps.vercel.app/.well-known/apple-app-site-association

# Should render the pin landing page
open "https://mustangmaps.vercel.app/p?lat=35.30205&lng=-120.66087&n=test"
```

Apple also publishes a validator: https://branch.io/resources/aasa-validator/

## After deploy

Rebuild the iOS app with `expo prebuild --clean && eas build` (or your usual flow) so the new `associatedDomains` entitlement takes effect. Universal Links won't fire until both:
- AASA file is reachable + valid at the domain, and
- App binary has been built with the entitlement.

Apple caches AASA aggressively — give it a few minutes after the first deploy. Reinstalling the app forces a re-fetch.
