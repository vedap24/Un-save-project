# Un{save} — Act on what you saved

> Stop saving. Start finishing.

---

## What Un{save} v1 does now

You paste any public link — an article, video, recipe, product page, or docs page. Un{save} fetches the page's metadata (title, description) and turns it into a clean card with an emoji. You then pick *when* you plan to act on it: today, tomorrow, this weekend, or someday. That's it.

No account needed. No AI. No images fetched. Just the core loop: **save → intent → timing → done**.

---

## Features in v1

| Feature | What it does |
|---|---|
| **Paste a link → emoji card** | Paste any public URL, get a preview card with title, description, emoji, and source domain |
| **Emoji type detection** | Article 📝, Video 🎥, Recipe 🍲, Product 🛍️, Docs 📄, Course 📚, Design 🎨, Job 💼, Audio 🎧, Generic 🔗 |
| **"Works best with" guidance** | Helper text explains which links preview well; "Try with" sample chips for quick testing |
| **Reminder scheduling** | Pick Today / Tomorrow / Weekend / Someday — stored with a real datetime |
| **Graceful fallback** | If a link can't be previewed, show a friendly message and still let you save it as a card |
| **Waitlist signup** | Email form with duplicate detection and source tracking |
| **Interactive demo** | 4-step no-login demo showing the full product flow |
| **Structured logging** | Every key event (preview, save, error) logged with timestamp and event name |
| **SQLite storage** | All links, reminders, and signups stored in a local file you can open and inspect |

---

## How the preview feature works

1. You paste a URL into the input field
2. The frontend sends it to `POST /api/preview-link` (our backend)
3. The backend fetches the page like a browser would
4. It reads the page's **Open Graph tags** (`og:title`, `og:description`), **Twitter Card tags**, and the basic HTML `<title>` tag
5. It figures out a "type" for the link (video? article? product?) based on the domain and keywords
6. It returns a simple JSON object: `{ title, description, domain, emoji, typeGuess }`
7. The frontend renders this as a card

**No AI is used.** No images are downloaded. Just the text metadata that every browser can read.

### Which links preview well?

Previews usually work for **public pages** that include Open Graph or Twitter Card metadata:

- Blog posts and articles (Medium, Substack, The Verge, dev.to, Hackernoon…)
- Product pages (Amazon, Etsy, eBay, Flipkart…)
- Documentation pages (MDN, GitHub README, Notion, Confluence…)
- Videos (YouTube, Vimeo, Twitch…)
- Links shared via LinkedIn, Slack, X/Twitter, Discord, WhatsApp, Telegram — these usually have good OG tags built in

### Which links won't preview well?

- **Login-only content** — Instagram posts, X/Twitter posts behind a login wall, LinkedIn profiles
- **Paywalled articles** — may return 403 or login page
- **Dynamic SPAs** that render only after JavaScript runs — the metadata may not be in the raw HTML
- **Very short links** — redirects may land on a generic homepage

When a preview fails, we still let you save the link as a fallback card. The domain name is used as the title. You'll see a friendly notice explaining why the full preview isn't available.

### Why aren't images fetched?

Fetching remote images would:
- Slow down the preview significantly
- Risk broken/missing images if the CDN is slow or blocked
- Add privacy implications (external requests)

For v1, emoji conveys the type clearly and loads instantly. Images are a v2 idea.

---

## How reminders are stored

When you save a card, you pick a timing. The backend calculates a real datetime:

| Your choice | What's stored as `reminder_at` |
|---|---|
| Today | Same day, 9:00 PM |
| Tomorrow | Next day, 9:00 AM |
| Weekend | Next Saturday, 10:00 AM |
| Someday | No specific time (null) |
| Custom | Exactly what you picked |

The reminder is stored in the `reminders` table alongside the `saved_links` table. Fields:

| Field | What it stores |
|---|---|
| `link_id` | Which saved link this reminder belongs to |
| `timing_label` | today / tomorrow / weekend / later / custom |
| `reminder_at` | ISO date string or null |
| `status` | pending (default) or done |
| `created_at` | When you saved it |

**v1 only stores the reminder.** There is no notification system yet — that's a v2 feature. Viewing reminders currently requires opening `unsave.db` in DB Browser for SQLite.

---

## Project structure (what each file does)

```
unsave/
├── backend/
│   ├── server.js          ← Starts the server, mounts all routes
│   ├── db.js              ← Database setup: waitlist, saved_links, reminders tables
│   ├── logger.js          ← Structured logging (timestamp + event name + data)
│   └── routes/
│       ├── waitlist.js    ← POST /api/waitlist  (email signups)
│       ├── preview.js     ← POST /api/preview-link  (fetch page metadata)
│       └── links.js       ← POST /api/links  (save card + reminder)
│
├── frontend/
│   ├── index.html         ← All sections: hero, paste-link, demo, focus, waitlist
│   ├── css/
│   │   └── style.css      ← All styling + new paste-link section styles
│   ├── js/
│   │   └── app.js         ← Demo logic + waitlist form + paste-link feature
│   └── assets/
│       ├── logo.png       ← Animated floating icon in hero
│       └── favicon.svg    ← Browser tab icon
│
├── .env                   ← Your local settings (not uploaded to GitHub)
├── .env.example           ← Template showing what settings are needed
├── .gitignore             ← Excludes .env, unsave.db, node_modules
├── package.json           ← Project dependencies and scripts
└── README.md              ← This file
```

---

## API endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/` | Serves the main HTML page |
| `POST` | `/api/waitlist` | Saves an email signup |
| `GET` | `/api/waitlist/count` | Returns signup count (no personal data) |
| `POST` | `/api/preview-link` | Fetches metadata for a URL, returns card data |
| `POST` | `/api/links` | Saves a link card + reminder to the database |

---

## How to run locally

### Requirements
- Node.js 18 or newer ([nodejs.org](https://nodejs.org))

### Steps
```bash
git clone <your-repo-url>
cd unsave
npm install
cp .env.example .env
npm start
```
Open: **http://localhost:3000**

---

## Testing the paste-link feature

### Sample links to test

| Type | URL | Expected result |
|---|---|---|
| Docs page | `https://developer.mozilla.org/en-US/docs/Web/HTML/Element/article` | Good preview: title + 📄 emoji |
| YouTube video | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | Good preview: 🎥 emoji + video title |
| GitHub README | `https://github.com/facebook/react` | Good preview: 📄 emoji + description |
| Amazon product | `https://www.amazon.com/dp/B09JQMJHXY` | Product card or fallback (Amazon blocks some fetches) |
| Login-required | `https://www.instagram.com/p/abc123` | Graceful fallback card + friendly notice |

### What "good" looks like
- Title shown (from the page's OG tags or `<title>`)
- Matching emoji for the content type
- Domain label in purple
- No broken UI

### What "fallback" looks like
- Domain name as the title (e.g. "instagram.com")
- Generic 🔗 emoji
- Amber notice: "We couldn't load a full preview for this link…"
- Save button still available — you can still save the raw link

### Test the API directly (optional)
```bash
# Good link
curl -X POST http://localhost:3000/api/preview-link \
  -H "Content-Type: application/json" \
  -d '{"url":"https://developer.mozilla.org/en-US/docs/Web/API/fetch"}'

# Fallback link
curl -X POST http://localhost:3000/api/preview-link \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.instagram.com/p/fakeid123"}'

# Save a card
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","title":"Test link","domain":"example.com","emoji":"🔗","typeGuess":"link","timing":"today"}'
```

---

## Logs, failures, and what to check if something breaks

### Where logs go (locally)
All logs print to your terminal where you ran `npm start`. They look like:
```json
{"time":"2025-05-11T10:00:00Z","event":"PREVIEW_SUCCESS","message":"Preview extracted","data":{"domain":"developer.mozilla.org","type":"docs"}}
{"time":"2025-05-11T10:00:01Z","event":"PREVIEW_FALLBACK","message":"Fetch failed, returning fallback","data":{"url":"https://...","reason":"HTTP 403"}}
```

### Event names and what they mean
| Event | Meaning |
|---|---|
| `SERVER_START` | Server started successfully |
| `PREVIEW_START` | Someone submitted a URL to preview |
| `PREVIEW_SUCCESS` | Metadata was fetched and a full card returned |
| `PREVIEW_FALLBACK` | Fetch failed but a fallback card was returned |
| `PREVIEW_ERROR` | Unexpected server-side crash during preview |
| `LINK_SAVE_SUCCESS` | A card + reminder was saved to the database |
| `LINK_SAVE_ERROR` | The card or reminder failed to save |
| `UNHANDLED_ERROR` | An unexpected crash in any route |

### Where logs go in production (Vercel)
1. Go to your Vercel project dashboard
2. Click **Deployments** → click your latest deployment
3. Click the **Logs** tab
4. You'll see the same JSON log lines
5. Use Vercel's search/filter to find specific events like `PREVIEW_ERROR`

### Common failures and what to do

**"Preview fetch keeps timing out"**
→ The site you're testing blocks automated fetches. This is normal. The fallback card will still appear. No action needed.

**"LINK_SAVE_ERROR in logs"**
→ Check that `backend/data/unsave.db` exists and the folder is writable. If on a server, make sure the filesystem isn't read-only.

**"Server won't start"**
→ Run `npm install` first. Check that port 3000 isn't already in use (`lsof -ti:3000`).

**"Database error on startup"**
→ Delete `backend/data/unsave.db` and restart — it will be recreated fresh (you'll lose any saved data).

**What to check first when the app seems broken:**
1. Is the terminal showing the startup banner? (If not, the server isn't running)
2. Is there a red `UNHANDLED_ERROR` event in the logs?
3. Is the database file present at `backend/data/unsave.db`?
4. Is your internet connection working? (needed for preview fetches)

### What errors users see (not what you see in logs)

| Situation | What user sees |
|---|---|
| Preview fetch fails | "We couldn't load a full preview…" (amber box) — can still save |
| URL is invalid | "That doesn't look like a valid URL" (inline error) |
| Server is down | "Sorry, we're having trouble on our side right now. Please try again." |
| User is offline | "You appear to be offline. Check your internet connection." |
| Unblockable site | Graceful fallback card, no crash, no raw error exposed |

---

## For the non-technical owner — plain English summary

**What was built:**
A real working website. You open it in a browser, paste any link, see a preview card with title and emoji, pick when you'll act on it, and click Save. The link and your timing choice get saved to a database file on your computer (or server).

**Where links are stored:**
In a file called `unsave.db` inside the `backend/data/` folder. Open it with [DB Browser for SQLite](https://sqlitebrowser.org/) to see all saved links and reminders. There are three tables: `waitlist` (email signups), `saved_links` (pasted URLs turned into cards), and `reminders` (when people planned to act).

**How a link becomes a card:**
1. You paste the URL and click "Preview →"
2. The backend fetches the page title and description (like a search engine would)
3. It guesses the type (video? article? recipe?) from the domain and text
4. It picks an emoji for that type
5. The frontend shows: [emoji] [title] [short description] [domain in purple]

**How reminders are saved:**
When you pick "Today", the backend calculates 9pm tonight and stores that datetime. When you pick "Someday", no specific time is stored — it's just flagged as "pending" so it's not forgotten.

**What to expect when a link doesn't preview nicely:**
Some sites (Instagram, X, paywalled news) block automated page fetches. When that happens, you'll see an amber message explaining it, and the card will show just the domain name as a fallback. You can still save that card — nothing breaks.

**Where email signups go:**
Also in `unsave.db`, in the `waitlist` table. Same file — open it with DB Browser for SQLite.

---

## Files changed in this update (v1.1)

| File | What changed |
|---|---|
| `backend/logger.js` | **New** — structured logging for all key events |
| `backend/db.js` | Added `saved_links` and `reminders` tables; added `saveLink()` and `saveReminder()` functions |
| `backend/server.js` | Added logger, mounted two new routes, added global error handler |
| `backend/routes/preview.js` | **New** — `POST /api/preview-link` (fetch + parse metadata) |
| `backend/routes/links.js` | **New** — `POST /api/links` (save card + reminder) |
| `frontend/index.html` | Added "Paste a link" section with URL input, sample chips, card preview, reminder picker, states |
| `frontend/css/style.css` | Added all CSS for the paste-link section using existing design tokens |
| `frontend/js/app.js` | Added paste-link feature block (all in an IIFE, no changes to existing demo/waitlist code) |

---

## v2 ideas (what to build next)

| Priority | Feature |
|---|---|
| 🔴 High | User accounts (magic link email login) |
| 🔴 High | Personal saved inbox — view your saved cards in one place |
| 🟡 Medium | Browser notification / reminder delivery system |
| 🟡 Medium | Admin view: see all signups + saved links without opening the DB file |
| 🟡 Medium | Move database to Supabase or Turso for cloud/multi-device sync |
| 🟢 Nice | WhatsApp reminder integration |
| 🟢 Nice | Browser extension ("save to Un{save}" from any page) |
| 🟢 Nice | CSV export for waitlist emails |
| 🟢 Nice | Richer card UI — fetch Open Graph image thumbnail for supported sites |
| 🟢 Nice | Weekly digest email: "your saved things this week" |

---

## Where to check "Get early access" signups

When someone fills in the waitlist form and clicks **"Get early access"**, their email is saved to your local database file. Here's how to see them:

**Option 1 — DB Browser for SQLite (recommended, free)**
1. Download [DB Browser for SQLite](https://sqlitebrowser.org/) — it's free and works on Mac/Windows
2. Open the file: `Un{save}/backend/data/unsave.db`
3. Click the **Browse Data** tab
4. Select the `waitlist` table from the dropdown
5. You'll see every signup: email, name, what they save most, when they joined

**Option 2 — Quick terminal command (if you're comfortable with the terminal)**
```bash
cd ~/Desktop/Un\{save\}
node -e "
  const db = require('./backend/db');
  // Wait a moment for DB to init, then check count
  setTimeout(async () => {
    const count = await db.getWaitlistCount();
    console.log('Total signups:', count);
  }, 500);
"
```

**What gets stored per signup:**
| Field | What it is |
|---|---|
| `email` | Their email address (lowercase, trimmed) |
| `name` | First/full name (optional, may be blank) |
| `saves_most` | What they selected from the dropdown |
| `source` | Where they came from (`direct`, `peerlist`, `twitter`, etc.) |
| `created_at` | Date and time they signed up |

> **Back up your signups regularly** — copy `backend/data/unsave.db` to a safe location. That one file is your entire waitlist.

---

---

## Deployment & Persistence

Un{save} v1 uses a hybrid database strategy to ensure reliability and persistence:

- **Local Development:** Uses **SQLite** (`backend/data/unsave.db`). No setup required.
- **Production (Vercel):** Uses **Vercel Postgres** for the waitlist. This ensures your signups are safe even when serverless functions reset.

### Vercel Deployment Steps

1. Push your code to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New"** → **"Project"**.
3. Import your `Un-save-project` repository.
4. **Before clicking Deploy:** Go to the **Storage** tab in your Vercel project, click **Connect Database**, and create a **Postgres** instance.
5. Vercel will automatically add `POSTGRES_URL` to your Environment Variables.
6. Click **Deploy**.

### Production Database Setup

Once deployed, you must create the `waitlist` table in your Vercel Postgres dashboard:

1. Go to the **Storage** tab in Vercel → select your Postgres database.
2. Click the **"Query"** tab.
3. Run this SQL to create the table:

```sql
CREATE TABLE waitlist (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  saves_most TEXT,
  source TEXT DEFAULT 'direct',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Verifying Signups
- **Local:** Open `backend/data/unsave.db` with [DB Browser for SQLite](https://sqlitebrowser.org/).
- **Production:** Go to the Vercel Postgres dashboard and click the **"Browse"** tab, or run `SELECT * FROM waitlist;` in the Query tab.

> **Note on Persistence:** On Vercel, the app uses **in-memory SQLite** for the interactive demo cards to comply with the platform's read-only filesystem. This keeps the landing page fast and crash-free. The **Waitlist (Postgres)** remains fully persistent and is unaffected by server restarts.

---

## Changelog

### v1.2 — Copy refinement pass (May 2026)
**Focus:** Tighten all messaging to reflect the real product truth — "clarify and act", not "bookmark and store".

**What changed (text only, no structural changes):**
- Page title: `Save later at one place` → `Act on what you saved`
- Hero headline: `Save later / at one place.` → `Stop saving. / Start finishing.`
- Hero eyebrow: removed generic scarcity phrase, added product context
- Hero primary CTA now scrolls to the paste-link feature instead of demo
- Paste section headline: `Save it with intent` → `Decide what to do with it`
- Demo bar title: `your saved inbox` → `your action queue`
- Demo next button: `Tag intent →` → `What will you do? →`
- Demo step 1 hint: updated to "Pick one thing from your backlog"
- Timing option "Someday" description: `Archive it. Won't be lost again.` → `Commit to it. Come back when ready.` (removes storage framing)
- Waitlist headline: `Be the first to use it` → `Shape what Un{save} becomes`
- Waitlist subtext: tightened to remove defensive language
- Success message: updated to be warmer and less formulaic
- Added GitHub chip to sample links section
- Updated sample article URL to one that actually resolves
- Save confirmation: `Your link is queued` → `One decision made. That's how the backlog clears.`
- Save button: `Save this card →` → `Lock it in →`

**What was intentionally preserved:**
- "You save things everywhere. Instagram, X, YouTube, Reddit. Then they vanish." — strongest opening line
- "Un{save} is the one place you actually *do* something with what you saved." — core value prop
- "Finish one saved thing before going back to the feed." — best line in the product
- "The feed will always have more. Your saved list already has enough." — sharp insight
- "One saved thing → one real action. That's how the backlog shrinks." — outcome language
- "Lock it in. Do it before the feed." — strong timing copy
- All layout, spacing, colors, interactions, and routes unchanged

### v1.1 — Core feature build (May 2026)
Added paste-link preview, reminder scheduling, SQLite storage for links/reminders, structured logging, and graceful error handling. See full file list in "Files changed" section above.

### v1.0 — MVP launch (May 2026)
Landing page with interactive demo, waitlist form, and Un{scroll} principle section.

---

*Un{save} v1 — Built May 2026*

