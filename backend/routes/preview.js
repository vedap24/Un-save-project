/**
 * preview.js — Link preview API route
 *
 * What this does (plain English):
 * POST /api/preview-link
 *   - Receives a URL from the frontend
 *   - Fetches the web page (like a browser would)
 *   - Reads the page's metadata (title, description, Open Graph tags)
 *   - Returns a simple card object: title, description, domain, emoji, typeGuess
 *   - If the page can't be fetched, returns a graceful fallback — never crashes
 *
 * No AI is used. No images are fetched. Just the page's text metadata.
 *
 * Logged events:
 *   PREVIEW_START   — request received
 *   PREVIEW_SUCCESS — metadata extracted successfully
 *   PREVIEW_FALLBACK — fetch failed, returning fallback card
 *   PREVIEW_ERROR   — unexpected internal error
 */

const express = require("express");
const router = express.Router();
const { log, logError } = require("../logger");

/* ─── Emoji / type mapping ────────────────────────────────────────────────── */
const TYPE_MAP = [
  { keywords: ["youtube.com", "vimeo.com", "twitch.tv", "tiktok.com", "dailymotion.com", "video", "watch"], type: "video",    emoji: "🎥" },
  { keywords: ["recipe", "food", "cook", "kitchen", "meal", "allrecipes.com", "tasty.co", "food52.com", "bbcgoodfood.com"], type: "recipe", emoji: "🍲" },
  { keywords: ["amazon.", "shop", "product", "buy", "price", "cart", "store", "etsy.com", "ebay.com", "flipkart.com"], type: "product", emoji: "🛍️" },
  { keywords: ["github.com", "docs.", "documentation", "developer.", "api.", "readme", "wiki", "notion.so", "confluence"], type: "docs", emoji: "📄" },
  { keywords: ["linkedin.com", "job", "hiring", "career", "resume", "work", "glassdoor.com", "lever.co", "greenhouse.io"], type: "job", emoji: "💼" },
  { keywords: ["medium.com", "substack.com", "blog", "article", "news", "post", "newsletter", "hackernoon.com", "dev.to"], type: "article", emoji: "📝" },
  { keywords: ["twitter.com", "x.com", "thread", "tweet"], type: "social", emoji: "🐦" },
  { keywords: ["spotify.com", "music", "podcast", "soundcloud.com", "apple.com/podcast"], type: "audio", emoji: "🎧" },
  { keywords: ["figma.com", "dribbble.com", "behance.net", "design", "ui", "ux", "prototype"], type: "design", emoji: "🎨" },
  { keywords: ["coursera.org", "udemy.com", "learn", "tutorial", "course", "class", "lesson", "edx.org"], type: "course", emoji: "📚" },
];

function guessType(url, title, description) {
  const text = `${url} ${title || ""} ${description || ""}`.toLowerCase();
  for (const entry of TYPE_MAP) {
    if (entry.keywords.some((k) => text.includes(k))) {
      return { type: entry.type, emoji: entry.emoji };
    }
  }
  return { type: "link", emoji: "🔗" };
}

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* ─── Metadata parser ─────────────────────────────────────────────────────── */
function parseMeta(html, url) {
  // Helper: pull content from first matching meta tag pattern
  function getMeta(pattern) {
    const m = html.match(pattern);
    if (!m) return null;
    return m[1]
      .replace(/&amp;/g,  "&")
      .replace(/&lt;/g,   "<")
      .replace(/&gt;/g,   ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g,  "'")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#\d+;/g, c => String.fromCharCode(parseInt(c.slice(2,-1), 10)))
      .trim();
  }


  // OG title → Twitter title → <title>
  const title =
    getMeta(/property=["']og:title["'][^>]*content=["']([^"']{1,200})["']/i) ||
    getMeta(/content=["']([^"']{1,200})["'][^>]*property=["']og:title["']/i) ||
    getMeta(/name=["']twitter:title["'][^>]*content=["']([^"']{1,200})["']/i) ||
    getMeta(/content=["']([^"']{1,200})["'][^>]*name=["']twitter:title["']/i) ||
    getMeta(/<title[^>]*>([^<]{1,200})<\/title>/i) ||
    null;

  // OG description → Twitter description → meta description
  const description =
    getMeta(/property=["']og:description["'][^>]*content=["']([^"']{1,300})["']/i) ||
    getMeta(/content=["']([^"']{1,300})["'][^>]*property=["']og:description["']/i) ||
    getMeta(/name=["']twitter:description["'][^>]*content=["']([^"']{1,300})["']/i) ||
    getMeta(/content=["']([^"']{1,300})["'][^>]*name=["']twitter:description["']/i) ||
    getMeta(/name=["']description["'][^>]*content=["']([^"']{1,300})["']/i) ||
    getMeta(/content=["']([^"']{1,300})["'][^>]*name=["']description["']/i) ||
    null;

  return { title, description };
}

/* ─── URL validator ───────────────────────────────────────────────────────── */
function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* ─── Route handler ───────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  const { url } = req.body;

  log("PREVIEW_START", "Link preview requested", { url: url ? url.substring(0, 100) : null });

  // 1. Validate URL
  if (!url || typeof url !== "string" || !isValidUrl(url.trim())) {
    return res.status(400).json({
      ok: false,
      fallback: false,
      message: "Please enter a valid URL starting with http:// or https://",
    });
  }

  const cleanUrl = url.trim();
  const domain = extractDomain(cleanUrl);

  // 2. Try to fetch the page
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000); // 7s timeout

    let html = "";
    let fetchFailed = false;
    let failReason = null;

    try {
      const response = await fetch(cleanUrl, {
        signal: controller.signal,
        headers: {
          // Pretend to be a normal browser so pages don't block us
          "User-Agent": "Mozilla/5.0 (compatible; UnSaveBot/1.0; +https://unsave.app)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        fetchFailed = true;
        failReason = `HTTP ${response.status}`;
      } else {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) {
          fetchFailed = true;
          failReason = "Not an HTML page";
        } else {
          // Read only first 50KB — enough for meta tags, avoids memory issues
          const buffer = await response.arrayBuffer();
          html = new TextDecoder().decode(buffer.slice(0, 51200));
        }
      }
    } catch (fetchErr) {
      clearTimeout(timeout);
      fetchFailed = true;
      if (fetchErr.name === "AbortError") {
        failReason = "Request timed out";
      } else {
        failReason = fetchErr.message || "Network error";
      }
    }

    if (fetchFailed || !html) {
      // Graceful fallback — still return a usable card
      log("PREVIEW_FALLBACK", "Fetch failed, returning fallback", { url: cleanUrl, reason: failReason });
      const { type, emoji } = guessType(cleanUrl, null, null);
      return res.json({
        ok: true,
        fallback: true,
        fallbackReason: failReason,
        card: {
          url: cleanUrl,
          title: domain,
          description: null,
          domain,
          typeGuess: type,
          emoji,
        },
        message: "We couldn't load a full preview for this link. You can still save it as a card.",
      });
    }

    // 3. Extract metadata
    const { title, description } = parseMeta(html, cleanUrl);
    const { type, emoji } = guessType(cleanUrl, title, description);

    // Trim description to 200 chars for display
    const shortDesc = description ? description.substring(0, 200) : null;

    const card = {
      url: cleanUrl,
      title: title || domain || "Untitled link",
      description: shortDesc,
      domain,
      typeGuess: type,
      emoji,
    };

    log("PREVIEW_SUCCESS", "Preview extracted", { domain, type });

    return res.json({
      ok: true,
      fallback: false,
      card,
    });

  } catch (err) {
    logError("PREVIEW_ERROR", "Unexpected error in preview route", err);
    return res.status(500).json({
      ok: false,
      fallback: true,
      message: "Sorry, we're having trouble on our side right now. Please try again in a moment.",
    });
  }
});

module.exports = router;
