# BodyPower.com — Phase 1 prototype

Static, dependency-free build of the BodyPower.com brand site, made from the
*Website Design & Development Brief* (v1.0, Nov 2026).

## Run it
```
python build.py            # builds ./dist
python build.py --serve    # builds and serves http://localhost:8008
```
Python 3 standard library only. Upload `dist/` to any static host.

## Structure
```
build.py                 config + page assembly, sitemap.xml, robots.txt
src/partials/            layout (head/meta), header + mobile drawer, footer
src/pages/*.html         one file per page; <!--meta--> block sets title, URL, SEO
src/assets/css/styles.css  design system (tokens at the top)
src/assets/js/main.js    header, drawer, reveal, consent, tracking, shop filter, enquiry form
```

## Before launch: `CONFIG` in build.py
| Key | Value | Source |
|---|---|---|
| `ticket_url` | `https://tickets.bodypower.com/events/bodypower/2207403` | Same Ticket Tailor event the old site's buttons load; page title "BODYPOWER GAMES 2027 – ExCeL London" (checked 6 Nov 2026) |
| `ticket_widget` | `bodypower` / `2207403` / `tickets.bodypower.com` | Ticket buttons open the Ticket Tailor "Select tickets" checkout in a pop-up over the page (same event the old site's widget loaded). Set to `None` to make them plain links. `ticket_url` stays as the no-JS / failure fallback, and Ctrl/Cmd-click still opens it in a new tab |
| `gtm_id` | `GTM-KFL3CRQQ` | Old site's container; now loads **only after analytics consent** |
| `contact_email` | `hello@bodypower.com` | Old site /pharmacy/ page |
| `community_url` | `bodypower-transform.discourse.group` | Brief; the old `bodypower-metabolic-health` URL redirects here |
| `form_endpoint` | *empty* | Form runs in demo mode until a CRM/handler is chosen |
| `socials` | *empty* | No social links found on the old site |
| `include_drafts` | `False` | Pages with `draft: true` in their meta block are skipped by the build |
| `review_mode` | `False` | `False` = presentation view: empty slots get a subtle branded fill and pending notes are quiet. `True` = reviewer view: every empty slot shows its photo brief and pending items get loud yellow tags |

## Old-site URLs
`vercel.json` 301-redirects `/workshops/` to `/games/#education`, `/pharmacy/` to `/partner/?category=pharmacy`,
and the old pharmacy deck URL to `/assets/docs/bodypower-pharmacy-partners.pdf` (the PDF is now hosted in this repo).
Once bodypower.com points here, anything else that existed on the old site returns the branded 404 page.

## Assets
- `src/assets/img/bodypower-logo-*`: trimmed from the official transparent logo (colours untouched).
- `src/assets/img/speakers/*`: headshots cropped from the old site's speaker-announcement cards (baked-in text removed).
- `src/assets/img/supertheatre-lineup*`: the supplied line-up banner (Games, Education section).
- `src/assets/img/products/athletic-dept-tee-*`: the supplied Athletic Dept. T-shirt design mockup, cropped to remove the generator watermark. Replace it with real product photography before the item goes on sale.
- `src/partials/tf-panel.html`: designed Transform community panel used where a members photo will go (Home, Games, Transform). Swap in a real, permissioned photo when available.
- **Not used:** the old site's `hero-athletes.webp`, because it shows AI-generated people (brief §2).
- `src/assets/img/brand/`: BodyPower Games 2027 artwork (from the Ticket Tailor event page) and the BodyPower Transform logo (bodypowertransform.com).
- `src/assets/img/temp/`: **temporary, openly licensed photos** from Wikimedia Commons (CC BY 2.0 / CC0), marked with `data-temp-image`.
  Attribution is on `/credits/` (required for CC BY). Swap each one for original BodyPower photography,
  then delete its entry from `src/pages/credits.html`. To find them all, search for `data-temp-image`.
- Deliberately left as photo slots, because stock would misrepresent something: archive "Then"/2008 images, clothing products,
  Transform coaches and members, the Expo floor and athletes at past events.
- Not used: the old site's workshop images (generic stock: GLP-1 vial, DNA render, beach runner). Unsplash photos were not used,
  because its download protection blocks automated fetching.

## Pending content
- **Photo slots**: every image area is a labelled `.slot`. Put an `<img>` (or `<video>`)
  inside `.slot__media`; the label and corner marks hide themselves.
- **"Pending approval" tags** (`.tbc`): search `class="tbc"` to list every unconfirmed
  item (dates, test names, prices, policies, company details). Replace each one as
  BodyPower approves the content.

## Analytics
Clicks on any `[data-track]` element push a GA4-style event to `dataLayer`, but only
after the visitor accepts analytics cookies. Events: `ticket_click` /
`ticket_click_pending`, `community_click`, `transform_click`, `shop_click`,
`partner_click`, `licence_click`, `shop_filter`, `generate_lead` (form success).
Add the GTM container in `applyConsent()` in main.js once the ID is confirmed.

## Deploy to Vercel
`vercel.json` already sets the build command (`python3 build.py`), output directory (`dist`), trailing-slash URLs,
redirects and security/cache headers. No framework preset, no dependencies, no install step.

1. Vercel dashboard -> **Add New -> Project** -> import `Sagar-Bawankule/bodypower.com`.
2. Leave **Framework Preset** as *Other*. Build/Output settings are read from `vercel.json`; don't override them.
3. *(Optional)* **Environment Variables**: `SITE_URL` = the exact public address (no trailing slash), e.g. `https://www.bodypower.com`.
   Canonical URLs, the sitemap and social previews use it. Leave unset for production on the real domain.
   For a first test on a `*.vercel.app` address set it to that address so Google doesn't see a mismatch.
4. **Deploy.** Every push to `main` redeploys; other branches get preview URLs (Vercel marks previews `noindex`).
5. **Domain** (Settings -> Domains): add `www.bodypower.com`, then `bodypower.com` set to redirect to `www`.
   Point DNS as Vercel instructs *only when ready to switch* from the old site (see launch checklist below).

### Before pointing the real domain at Vercel
- The old site's pages (`/workshops/`, `/pharmacy/` and the ticket buttons) stop working the moment DNS changes. Confirm the ticket pop-up works on the preview first.
- Check the Ticket Tailor checkout opens from the preview URL, and the Partner enquiry form (still demo mode: set `form_endpoint` in `build.py` first).
- Copy anything else the old host serves that you still need.
- Lower the domain's DNS TTL a day beforehand so a rollback is quick.
- Fill in the `PENDING` items listed in this README, or leave `review_mode` off so they read as quiet notes.

## Design system ("Kinetic")
Built to feel as bold as bodypowergames.com while staying its own thing. Edit tokens at the top of `src/assets/css/styles.css`.
- **Slanted bars**: the three rising bars from the BodyPower mark are the brand device: hero overlay (`--bars`), slanted section edges (`.slant`), slanted buttons, ticker band.
- **Duotone heroes**: yellow/black treatment generated from the photos (`src/assets/img/hero/`). Keeps mixed-quality photography on-brand and text legible. To make a new one: grayscale, gamma ~1.75, map black to `#080808` and white to `#F5DC27` (Pillow `ImageOps.colorize`).
- **Highlighter word**: `<span class="mark">` puts a slanted yellow block behind one key word. Inside `.hero__title`, `.hl` does the same.
- **Components**: ticker (`{{TICKER}}`), speaker carousel (`{{SPEAKERS}}`), countdown (`data-countdown`), photo tiles (`.tile`, `.tests`, `.xp`), index rows (`.index`), mobile ticket bar (`.ticket-bar`).
- **Motion**: ticker, hero bars and parallax respect `prefers-reduced-motion`, and the **Pause motion** button (WCAG 2.2.2) stops the moving band for everyone.
- **Countdown target** is set in the page markup: `data-countdown="2027-05-21T09:00:00+01:00"`. `ticket_from` in `build.py` feeds the mobile ticket bar price.

## Photography sources (check before launch)
- **BodyPower's own**: expo archive photos (`tiles/expo-*`, `hero/home`, `hero/story`), logos, speaker cards, T-shirt mockups. Taken from bodypowergames.com / bodypower.com.
- **Free-licence stock**: Pexels (Calisthenics, Cardio, Games hero) and Wikimedia Commons (credited on `/credits/`).
- **Needs confirming**: the Raw Power, Explosive Power, Fight, Balance and Mobility test photos came from the BodyPower Games website with no photographer named. They are listed on `/credits/` as "to be confirmed". Replace them or confirm the licence.
