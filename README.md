# The AI Compass

A one-dot survey. Visitors place a dot on a chart:

- **Horizontal:** AI's benefit to society, from *AI kills us all* (left) to *AI creates a utopia* (right).
- **Vertical:** AI's potential usefulness, from *stochastic parrot* (bottom) to *machine god* (top).

Dotted lines mark intermediate phases. After submitting, visitors see every dot, the average, a quadrant breakdown, and can filter by which subreddit link they came from.

The site is a single static page (`index.html`). Responses go to a Google Sheet through a small Apps Script (`backend/Code.gs`).

## 1. Publish the site (Netlify)

The site is hosted on Netlify, connected to this repo's `main` branch with no build command, so every push to `main` redeploys it. It's live at `https://where-do-you-land-on-ai.netlify.app/`.

Until step 2 below is done, the page runs in preview mode: everything works, but dots are only saved in the visitor's own browser.

## 2. Connect the results sheet (about 5 minutes)

1. Create a new Google Sheet (sheets.new). Name it anything, e.g. "AI Compass responses".
2. In the sheet: **Extensions → Apps Script**. Delete the starter code and paste in all of `backend/Code.gs`. Save. (On Android, where Sheets links open in the app, skip step 1 and start a new project at script.google.com instead; the script creates its own spreadsheet.)
3. In the function dropdown pick `setup` and press **Run**. Approve the permissions prompt (Google words it as access to your spreadsheets; the script only touches the one it uses). A `responses` tab appears in the sheet.
4. **Deploy → New deployment**. Gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Press **Deploy** and copy the **Web app URL** (ends in `/exec`).
5. In `index.html`, set `var ENDPOINT = "…/exec";` to that URL and commit.

Every response lands as a row in the sheet: `id, x, y, source, peeked, created, updated`. Coordinates run from −100 to +100.

If you later edit `Code.gs`, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## 3. Posting to subreddits

Add `?r=<subreddit>` to the link for each post, so results can be split by community:

- `https://where-do-you-land-on-ai.netlify.app/?r=betteroffline`
- `https://where-do-you-land-on-ai.netlify.app/?r=singularity`
- `https://where-do-you-land-on-ai.netlify.app/?r=technology`

The results view shows a filter chip per community, with its own average and quadrant split. Visitors from a plain link are counted as "Direct link".

## Notes on the data

- **One dot per browser.** A random ID in the visitor's browser lets them move their dot later; resubmitting moves the existing row instead of adding a new one. Someone determined can still vote again from a private window, so treat results as a vibe check, not a poll.
- **Results are hidden until you answer**, to avoid anchoring. Visitors can peek first; anyone who peeked and then answered gets `peeked = 1` in the sheet, so you can filter them out.
- **Load:** Apps Script handles roughly 30 simultaneous requests and the results feed is cached for 20 seconds. A busy Reddit thread should be fine; if submissions fail during a spike, the page tells people to try again.
