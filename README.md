# The AI Compass

A one-dot survey. Visitors place a dot on a chart:

- **Horizontal:** AI's benefit to society, from *AI kills us all* (left) to *AI creates a utopia* (right).
- **Vertical:** AI's potential usefulness, from *stochastic parrot* (bottom) to *machine god* (top).

Dotted lines mark intermediate phases. After submitting, visitors see every dot, the average, a quadrant breakdown, and can filter by which subreddit link they came from.

The site is a static page (`index.html`) plus one Netlify Function (`netlify/functions/dots.mjs`) that stores dots in Netlify Blobs. There is nothing to configure: Netlify installs the dependency and deploys the function on every push to `main`.

## Hosting

Netlify, connected to this repo's `main` branch. Live at `https://where-do-you-land-on-ai.netlify.app/`.

Each push to `main` is a production deploy, which uses Netlify free-plan credits, so batch changes into as few pushes as possible.

## The data

- `GET /api/dots` returns `{ sources: [...], points: [x, y, sourceIndex, ...] }` with coordinates from −100 to +100. It's cached at Netlify's edge for 15 seconds.
- Each dot is one blob key: `d/<id>/<time>/<x>/<y>/<source>/<peeked>`. Respondent IDs are never sent to browsers.
- To download everything as a CSV, open `https://where-do-you-land-on-ai.netlify.app/api/dots` and ask Claude to convert it, or browse the `dots` store under the site's **Blobs** tab in Netlify.

## Posting to subreddits

Add `?r=<subreddit>` to the link for each post, so results can be split by community:

- `https://where-do-you-land-on-ai.netlify.app/?r=betteroffline`
- `https://where-do-you-land-on-ai.netlify.app/?r=singularity`
- `https://where-do-you-land-on-ai.netlify.app/?r=technology`

The results view shows a filter chip per community, with its own average and quadrant split. Visitors from a plain link are counted as "Direct link".

## Notes on the data

- **One dot per browser.** A random ID in the visitor's browser lets them move their dot later; resubmitting moves the existing dot instead of adding a new one. Someone determined can still vote again from a private window, so treat results as a vibe check, not a poll.
- **Results are hidden until you answer**, to avoid anchoring. Visitors can peek first; anyone who peeked and then answered is stored with `peeked = 1`, so they can be filtered out.
