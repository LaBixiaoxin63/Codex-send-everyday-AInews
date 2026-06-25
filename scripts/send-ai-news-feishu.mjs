const WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL;
const DRY_RUN = process.env.AI_NEWS_DRY_RUN === "1";
const TEST_RUN = process.env.AI_NEWS_TEST === "1";
const DIGEST_MODE = process.env.AI_NEWS_MODE || "daily";
const DIGEST_DATE = process.env.AI_NEWS_DATE || "";
const FEED_TIMEOUT_MS = Number.parseInt(process.env.AI_NEWS_FEED_TIMEOUT_MS || "20000", 10);
const FEISHU_API_TIMEOUT_MS = Number.parseInt(process.env.FEISHU_API_TIMEOUT_MS || "15000", 10);
const FEISHU_API_MAX_ATTEMPTS = Math.max(
  1,
  Number.parseInt(process.env.FEISHU_API_MAX_ATTEMPTS || "3", 10),
);
const PRODUCTJUN_MAX_AGE_HOURS = Number.parseInt(process.env.AI_NEWS_PRODUCTJUN_MAX_AGE_HOURS || "72", 10);
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || "";
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || "";
const FEISHU_BITABLE_APP_TOKEN = process.env.FEISHU_BITABLE_APP_TOKEN || "";
const FEISHU_BITABLE_TABLE_ID = process.env.FEISHU_BITABLE_TABLE_ID || "";
const FEISHU_DOC_FOLDER_TOKEN = process.env.FEISHU_DOC_FOLDER_TOKEN || "";
const FEISHU_BITABLE_URL =
  FEISHU_BITABLE_APP_TOKEN && FEISHU_BITABLE_TABLE_ID
    ? `https://my.feishu.cn/base/${FEISHU_BITABLE_APP_TOKEN}?table=${FEISHU_BITABLE_TABLE_ID}`
    : "";

const DAILY_MAX_ITEMS = Number.parseInt(process.env.AI_NEWS_DAILY_LIMIT || "8", 10);
const WEEKLY_MAX_ITEMS = Number.parseInt(process.env.AI_NEWS_WEEKLY_LIMIT || "10", 10);
const OFFICIAL_MAX_ITEMS = Number.parseInt(process.env.AI_NEWS_OFFICIAL_LIMIT || "12", 10);

const JUYA_FEEDS = [
  {
    name: "橘鸦 AI 早报",
    url: "https://daily.juya.uk/rss.xml",
  },
  {
    name: "橘鸦 AI 早报镜像",
    url: "https://jujuyaya.github.io/juya-ai-daily/rss.xml",
  },
];

const PRODUCTJUN_FEEDS = [
  {
    name: "产品君 Bilibili RSS",
    url: "https://hub.vincentxue.com/bilibili/user/video/1845434732",
  },
  {
    name: "产品君 Bilibili RSSHub",
    url: "https://rsshub.app/bilibili/user/video/1845434732",
  },
];

const OFFICIAL_RSS_FEEDS = [
  {
    sourceName: "OpenAI",
    url: "https://openai.com/news/rss.xml",
  },
  {
    sourceName: "Google DeepMind",
    url: "https://deepmind.google/blog/rss.xml",
  },
];

const OFFICIAL_HTML_SOURCES = [
  {
    sourceName: "Anthropic",
    url: "https://www.anthropic.com/news",
    pathPattern: /^\/news\//,
  },
  {
    sourceName: "Anthropic Research",
    url: "https://www.anthropic.com/research",
    pathPattern: /^\/research\//,
  },
  {
    sourceName: "Anthropic Engineering",
    url: "https://www.anthropic.com/engineering",
    pathPattern: /^\/engineering\//,
  },
  {
    sourceName: "xAI / Grok",
    url: "https://x.ai/news",
    pathPattern: /^\/news\//,
  },
];

if (!WEBHOOK_URL && !DRY_RUN) {
  throw new Error("Missing FEISHU_WEBHOOK_URL environment variable.");
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function decodeEntitiesDeep(text) {
  let decoded = String(text || "");
  for (let index = 0; index < 3; index += 1) {
    const next = decodeEntities(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function stripHtml(text) {
  return decodeEntitiesDeep(text)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstMatch(text, pattern) {
  const match = String(text || "").match(pattern);
  if (!match) return "";
  return decodeEntitiesDeep(match.slice(1).find((value) => value !== undefined) || "").trim();
}

function trimText(text, maxLength) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nowInShanghai() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function partsInShanghai(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function formatDateInShanghai(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateTimeInShanghai(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function officialDigestWindow(now = new Date(), dateText = "") {
  const requestedDate = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (requestedDate) {
    const [, year, month, day] = requestedDate.map(Number);
    const endMs = Date.UTC(year, month - 1, day, 9, 0, 0);
    const startMs = endMs - 24 * 60 * 60 * 1000;
    return {
      startMs,
      endMs,
      date: formatDateInShanghai(new Date(endMs)),
      label: `${formatDateTimeInShanghai(new Date(startMs))} 至 ${formatDateTimeInShanghai(new Date(endMs))}`,
    };
  }

  const parts = partsInShanghai(now);
  let endMs = Date.UTC(parts.year, parts.month - 1, parts.day, 9, 0, 0);
  if (now.getTime() < endMs) endMs -= 24 * 60 * 60 * 1000;

  const startMs = endMs - 24 * 60 * 60 * 1000;
  return {
    startMs,
    endMs,
    date: formatDateInShanghai(new Date(endMs)),
    label: `${formatDateTimeInShanghai(new Date(startMs))} 至 ${formatDateTimeInShanghai(new Date(endMs))}`,
  };
}

function dateOnlyToShanghaiTimestamp(dateText) {
  const match = String(dateText || "").match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match.map(Number);
    return Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000;
  }

  const timestamp = Date.parse(dateText || "");
  if (Number.isFinite(timestamp)) return timestamp;
  return Date.now();
}

function normalizeDateOnly(value) {
  if (typeof value === "number") {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  }

  const match = String(value || "").match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function archiveDedupeKey(date, title) {
  return `${normalizeDateOnly(date)}::${String(title || "").trim()}`;
}

function parseDate(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function recentEnough(published, maxAgeHours) {
  const timestamp = parseDate(published);
  return timestamp > 0 && Date.now() - timestamp <= maxAgeHours * 60 * 60 * 1000;
}

function splitFeedItems(xml) {
  return [...String(xml || "").matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)].map(([, block]) => block);
}

function parseRssItems(xml) {
  return splitFeedItems(xml).map((block) => ({
    title: stripHtml(firstMatch(block, /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/)),
    description: firstMatch(block, /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/),
    content: firstMatch(block, /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>|<content:encoded>([\s\S]*?)<\/content:encoded>/),
    link: firstMatch(block, /<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>|<link>([\s\S]*?)<\/link>/),
    published: firstMatch(block, /<pubDate>([\s\S]*?)<\/pubDate>/),
  }));
}

function parseJuyaDaily(xml) {
  const latest = parseRssItems(xml)[0];
  if (!latest) return null;

  const overview = firstMatch(latest.content, /<h2>概览<\/h2>([\s\S]*?)(?:<hr>|<h2>详细|$)/);
  const source = overview || latest.content || latest.description;
  const items = [];

  for (const section of source.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/g)) {
    const category = stripHtml(section[1]);
    for (const match of section[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      const raw = match[1];
      const link = firstMatch(raw, /<a\b[^>]*href=["']([^"']+)["'][^>]*>/);
      const title = stripHtml(raw)
        .replace(/\s*↗\s*/g, "")
        .replace(/\s*#\d+\s*$/g, "")
        .trim();
      if (title) items.push({ title, link: link || latest.link, category });
    }
  }

  if (!items.length) {
    const text = stripHtml(latest.description);
    const overviewText = text.match(/概览\s+([\s\S]*?)(?:\s+要闻\s+.+?\s+\d+\s+据|\s+要闻\s+.+?$|$)/)?.[1] || text;
    const lines = overviewText
      .split(/(?=\s*(?:要闻|产品应用|开发生态|模型发布|研究论文|投融资|行业动态|开源生态|多模态|AI 应用)\s+)/)
      .map((line) => line.trim())
      .filter((line) => line && !/^AI 早报|^视频版|^概览$/.test(line))
      .slice(0, DAILY_MAX_ITEMS);
    for (const line of lines) {
      items.push({ title: line.replace(/\s*↗\s*#?\d*$/g, ""), link: latest.link, category: "要点" });
    }
  }

  return {
    sourceName: "橘鸦 AI 早报",
    title: latest.title || todayInShanghai(),
    link: latest.link,
    published: latest.published,
    items,
  };
}

function productJunDescriptionLines(description) {
  return stripHtml(description)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !/^https?:\/\//i.test(line))
    .filter((line) => !/^视频|^播放|^弹幕|^未经作者授权/i.test(line))
    .slice(0, WEEKLY_MAX_ITEMS);
}

function parseProductJunWeekly(xml) {
  const candidates = parseRssItems(xml)
    .filter((item) => /AI|人工智能|一周|周报|盘点|大事/i.test(`${item.title} ${stripHtml(item.description)}`))
    .sort((a, b) => parseDate(b.published) - parseDate(a.published));

  const latest = candidates[0] || parseRssItems(xml).sort((a, b) => parseDate(b.published) - parseDate(a.published))[0];
  if (!latest) return null;

  return {
    sourceName: "产品君",
    title: latest.title,
    link: latest.link,
    published: latest.published,
    lines: productJunDescriptionLines(latest.description),
  };
}

function absoluteUrl(baseUrl, href) {
  try {
    return new URL(decodeEntitiesDeep(href), baseUrl).toString();
  } catch {
    return "";
  }
}

function parseOfficialRssItems(xml, sourceName) {
  return parseRssItems(xml)
    .map((item) => ({
      title: item.title,
      link: item.link,
      published: item.published,
      publishedTs: parseDate(item.published),
      category: sourceName,
      source: sourceName,
    }))
    .filter((item) => item.title && item.link && item.publishedTs > 0);
}

function parseHtmlDate(text) {
  const normalized = stripHtml(text).replace(/\s+/g, " ");
  const match = normalized.match(
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},\s+\d{4}\b/i,
  );
  if (!match) return "";
  return match[0].replace(/\bSept\b/i, "Sep");
}

function parseOfficialHtmlItems(html, source) {
  const items = [];
  const seen = new Set();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of String(html || "").matchAll(anchorPattern)) {
    const href = decodeEntitiesDeep(match[1]);
    let path;
    try {
      path = new URL(href, source.url).pathname;
    } catch {
      continue;
    }
    if (!source.pathPattern.test(path)) continue;

    const block = match[0];
    const nearby = String(html).slice(Math.max(0, match.index - 500), Math.min(String(html).length, match.index + block.length + 1200));
    const title =
      stripHtml(firstMatch(block, /<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i)) ||
      stripHtml(firstMatch(block, /aria-label=["']([^"']+)["']/i)) ||
      stripHtml(firstMatch(block, /alt=["']([^"']+)["']/i));
    const published = parseHtmlDate(block) || parseHtmlDate(nearby);
    const link = absoluteUrl(source.url, href);
    const key = `${source.sourceName}::${link || title}`;
    const publishedTs = parseDate(published);

    if (!title || !link || !publishedTs || seen.has(key)) continue;
    seen.add(key);
    items.push({
      title,
      link,
      published,
      publishedTs,
      category: source.sourceName,
      source: source.sourceName,
    });
  }

  return items;
}

async function fetchText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    headers: { "user-agent": "ai-news-feishu-digest/3.0" },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!/<rss\b|<feed\b/i.test(text) || !/<item\b|<entry\b/i.test(text)) {
    throw new Error("not an RSS/Atom feed");
  }
  return text;
}

async function fetchPageText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    headers: { "user-agent": "Mozilla/5.0 (compatible; ai-news-feishu-digest/3.0)" },
    redirect: "follow",
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchFirstAvailable(feeds) {
  const errors = [];
  for (const feed of feeds) {
    try {
      const text = await fetchText(feed.url);
      return { feed, text };
    } catch (error) {
      errors.push(`${feed.name}: ${error.message}`);
    }
  }
  throw new Error(errors.join("; "));
}

async function collectOfficialItems(window) {
  const errors = [];
  const items = [];
  let successCount = 0;

  for (const feed of OFFICIAL_RSS_FEEDS) {
    try {
      const text = await fetchText(feed.url);
      items.push(...parseOfficialRssItems(text, feed.sourceName));
      successCount += 1;
    } catch (error) {
      errors.push(`${feed.sourceName}: ${error.message}`);
    }
  }

  for (const source of OFFICIAL_HTML_SOURCES) {
    try {
      const text = await fetchPageText(source.url);
      items.push(...parseOfficialHtmlItems(text, source));
      successCount += 1;
    } catch (error) {
      errors.push(`${source.sourceName}: ${error.message}`);
    }
  }

  const seen = new Set();
  const filteredItems = items
    .filter((item) => item.publishedTs > window.startMs && item.publishedTs <= window.endMs)
    .sort((a, b) => b.publishedTs - a.publishedTs)
    .filter((item) => {
      const key = `${item.source}::${item.link || item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return { items: filteredItems, errors, successCount };
}

async function hydrateProductJunBilibiliDescription(digest) {
  const bvid = digest.link.match(/\/video\/(BV[\w]+)/i)?.[1];
  if (!bvid) return digest;

  try {
    const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: "https://www.bilibili.com/",
      },
    });
    if (!response.ok) return digest;

    const detail = await response.json();
    const lines = productJunDescriptionLines(detail.data?.desc);
    if (detail.code === 0) {
      return {
        ...digest,
        title: detail.data?.title || digest.title,
        lines: lines.length ? lines : digest.lines,
      };
    }
  } catch {
    return digest;
  }

  return digest;
}

function buildPostMessage({ title, sourceName, sourceUrl, date, items, footer, archiveUrl }) {
  const content = [
    [
      {
        tag: "text",
        text: `${title}\n${sourceName}｜${date}\n\n`,
      },
    ],
  ];

  items.forEach((item, index) => {
    content.push([
      {
        tag: "text",
        text: `${index + 1}. ${trimText(item.title, 90)}${item.category ? `｜${item.category}` : ""}\n`,
      },
    ]);
    if (item.link) {
      content.push([{ tag: "a", text: "原文", href: item.link }, { tag: "text", text: "\n\n" }]);
    } else {
      content.push([{ tag: "text", text: "\n" }]);
    }
  });

  content.push([
    {
      tag: "text",
      text: `${footer || "仅整理指定博主来源；不再混入媒体 RSS 或官网新闻。"}\n`,
    },
  ]);

  if (archiveUrl) {
    content.push([
      { tag: "text", text: "归档入口：" },
      { tag: "a", text: "打开多维表格", href: archiveUrl },
      { tag: "text", text: "\n" },
    ]);
  }

  if (sourceUrl) {
    content.push([{ tag: "a", text: "查看原始发布", href: sourceUrl }]);
  }

  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title,
          content,
        },
      },
    },
  };
}

function buildUnavailableMessage({ mode, sourceName, error }) {
  const title = mode === "weekly" ? "AI 周报暂未发送" : "AI 早报暂未发送";
  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title,
          content: [
            [
              {
                tag: "text",
                text:
                  `${title}｜${todayInShanghai()}\n\n` +
                  `指定来源：${sourceName}\n` +
                  `状态：来源不可用或当天内容未更新。\n\n` +
                  `原因：${trimText(error, 240)}\n\n` +
                  "处理策略：已按你的要求关闭媒体/官网 fallback，所以今天不会改用 36氪、IT之家、Google News 等来源替代。\n",
              },
            ],
          ],
        },
      },
    },
  };
}

function buildOfficialNoUpdateMessage({ window, errors, successCount }) {
  const title = `官方 AI 一手动态｜${window.date}`;
  const statusLine =
    successCount > 0
      ? "今日官方源暂无更新。"
      : `官方源暂时不可访问，未能完成检查：${trimText(errors.join("; "), 180)}`;
  const footerParts = [
    `统计窗口：${window.label}`,
    statusLine,
    "仅检查官方一手来源：OpenAI、Anthropic、Google DeepMind、xAI/Grok。",
  ];

  return buildPostMessage({
    title,
    sourceName: "官方一手来源",
    sourceUrl: "",
    date: window.date,
    items: [{ title: "今日官方源暂无更新", category: "状态" }],
    footer: footerParts.join("\n"),
    archiveUrl: FEISHU_BITABLE_URL,
  });
}

function sourceWithFeed(sourceName, feedName) {
  return sourceName === feedName ? sourceName : `${sourceName}（${feedName}）`;
}

function digestTypeLabel(mode) {
  if (mode === "weekly") return "周报";
  if (mode === "official") return "官方";
  return "日报";
}

function hasFeishuArchiveConfig() {
  return Boolean(FEISHU_APP_ID && FEISHU_APP_SECRET && (FEISHU_BITABLE_APP_TOKEN || FEISHU_DOC_FOLDER_TOKEN));
}

async function getTenantAccessToken() {
  let lastError;

  for (let attempt = 1; attempt <= FEISHU_API_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          app_id: FEISHU_APP_ID,
          app_secret: FEISHU_APP_SECRET,
        }),
        signal: AbortSignal.timeout(FEISHU_API_TIMEOUT_MS),
      });

      const responseText = await response.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { raw: responseText };
      }

      if (response.ok && data.code === 0) return data.tenant_access_token;

      lastError = new Error(`tenant_access_token failed: ${response.status} ${JSON.stringify(data)}`);
      if (
        !isRetryableFeishuFailure(response.status, data) ||
        attempt === FEISHU_API_MAX_ATTEMPTS
      ) {
        throw lastError;
      }
    } catch (error) {
      if (error === lastError) throw error;

      lastError = error;
      if (
        !isRetryableFeishuFailure(0, null, error) ||
        attempt === FEISHU_API_MAX_ATTEMPTS
      ) {
        throw error;
      }
    }

    const delay = 500 * 2 ** (attempt - 1);
    console.warn(
      `Feishu token request failed, retrying in ${delay}ms (${attempt}/${FEISHU_API_MAX_ATTEMPTS}): ${lastError.message}`,
    );
    await sleep(delay);
  }

  throw lastError;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseRetryAfterMilliseconds(value) {
  if (!value) return 0;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : 0;
}

function isRetryableFeishuFailure(status, data, error) {
  if (error) return error.name === "TimeoutError" || error.name === "AbortError" || error instanceof TypeError;
  if (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500) return true;

  const retryableCodes = new Set([
    99991400, // Rate limit exceeded.
    99991401, // App rate limit exceeded.
    99991663, // API frequency limit exceeded.
    1254290, // Bitable request frequency limit.
    1254291, // Bitable write conflict.
    1254607, // Bitable data is not ready.
    1255001, // Bitable internal error.
    1255040, // Bitable request timeout.
    800004135, // Base search service temporary failure.
  ]);
  if (retryableCodes.has(Number(data?.code))) return true;

  return /rate.?limit|too many requests|frequency limit|write conflict|data is not ready|system busy|internal error|timeout/i.test(
    String(data?.msg || data?.message || ""),
  );
}

async function feishuApi(path, { method = "GET", token, body, retryAmbiguous = method === "GET" } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= FEISHU_API_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`https://open.feishu.cn/open-apis${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(FEISHU_API_TIMEOUT_MS),
      });

      const responseText = await response.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { raw: responseText };
      }

      if (response.ok && data.code === 0) return data.data || {};

      lastError = new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(data)}`);
      const ambiguousFailure = response.status === 408 || response.status >= 500;
      if (
        !isRetryableFeishuFailure(response.status, data) ||
        (ambiguousFailure && !retryAmbiguous) ||
        attempt === FEISHU_API_MAX_ATTEMPTS
      ) {
        throw lastError;
      }

      const retryAfter = parseRetryAfterMilliseconds(response.headers.get("retry-after"));
      const delay = retryAfter || 500 * 2 ** (attempt - 1);
      console.warn(
        `Feishu API transient failure, retrying in ${delay}ms (${attempt}/${FEISHU_API_MAX_ATTEMPTS}): ${lastError.message}`,
      );
      await sleep(delay);
    } catch (error) {
      if (error === lastError) throw error;

      lastError = error;
      if (
        !retryAmbiguous ||
        !isRetryableFeishuFailure(0, null, error) ||
        attempt === FEISHU_API_MAX_ATTEMPTS
      ) {
        throw error;
      }

      const delay = 500 * 2 ** (attempt - 1);
      console.warn(
        `Feishu API request failed, retrying in ${delay}ms (${attempt}/${FEISHU_API_MAX_ATTEMPTS}): ${error.message}`,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

function digestPlainText(digest) {
  return [
    `${digest.title}`,
    `${digest.sourceName}｜${digest.date}`,
    "",
    ...digest.items.map((item, index) => `${index + 1}. ${item.title}${item.category ? `｜${item.category}` : ""}\n${item.link || ""}`),
    "",
    digest.sourceUrl ? `原始发布：${digest.sourceUrl}` : "",
  ].filter(Boolean).join("\n");
}

async function archiveDigestToBitable(digest, token) {
  if (!FEISHU_BITABLE_APP_TOKEN || !FEISHU_BITABLE_TABLE_ID) return null;

  const existingKeys = new Set();
  const selectedItems = [];
  let canListRecords = true;

  try {
    let pageToken = "";
    do {
      const query = new URLSearchParams({
        page_size: "500",
        field_names: JSON.stringify(["日期", "标题"]),
      });
      if (pageToken) query.set("page_token", pageToken);

      const page = await feishuApi(
        `/bitable/v1/apps/${FEISHU_BITABLE_APP_TOKEN}/tables/${FEISHU_BITABLE_TABLE_ID}/records?${query}`,
        { token },
      );

      for (const record of page.items || []) {
        const fields = record.fields || {};
        existingKeys.add(archiveDedupeKey(fields["日期"], fields["标题"]));
      }
      pageToken = page.has_more ? page.page_token || "" : "";
    } while (pageToken);
  } catch (error) {
    if (!String(error.message).includes('"code":99991672')) throw error;
    canListRecords = false;
    console.warn("Feishu record list permission unavailable; falling back to Base V3 title search.");
  }

  for (const [index, item] of digest.items.entries()) {
    const key = archiveDedupeKey(digest.date, item.title);
    if (existingKeys.has(key)) continue;

    if (!canListRecords) {
      const searchResult = await feishuApi(
        `/base/v3/bases/${FEISHU_BITABLE_APP_TOKEN}/tables/${FEISHU_BITABLE_TABLE_ID}/records/search`,
        {
          method: "POST",
          token,
          body: {
            keyword: trimText(item.title, 120),
            search_fields: ["标题"],
            select_fields: ["日期", "标题", "原文链接"],
            limit: 20,
          },
          retryAmbiguous: true,
        },
      );
      const exists = (searchResult.data || []).some((row) => archiveDedupeKey(row[0], row[1]) === key);
      if (exists) {
        existingKeys.add(key);
        continue;
      }
    }

    existingKeys.add(key);
    selectedItems.push({ item, index });
  }

  const records = selectedItems.map(({ item, index }) => ({
    fields: {
      日期: dateOnlyToShanghaiTimestamp(digest.date),
      类型: digestTypeLabel(digest.mode),
      序号: String(index + 1),
      标题: item.title,
      分类: item.category || "",
      来源: item.source || digest.sourceName,
      原文链接: item.link || digest.sourceUrl || "",
      发布标题: digest.title,
      原始发布: digest.sourceUrl || "",
      归档时间: nowInShanghai(),
    },
  }));

  const skippedCount = digest.items.length - records.length;
  if (!records.length) return `多维表格已存在 ${skippedCount} 条，本次未重复写入`;

  const clientToken = globalThis.crypto.randomUUID();
  await feishuApi(
    `/bitable/v1/apps/${FEISHU_BITABLE_APP_TOKEN}/tables/${FEISHU_BITABLE_TABLE_ID}/records/batch_create?client_token=${encodeURIComponent(clientToken)}`,
    {
      method: "POST",
      token,
      body: { records },
      retryAmbiguous: true,
    },
  );

  return skippedCount > 0
    ? `多维表格已写入 ${records.length} 条，跳过 ${skippedCount} 条重复`
    : `多维表格已写入 ${records.length} 条`;
}

async function archiveDigestToDoc(digest, token) {
  if (!FEISHU_DOC_FOLDER_TOKEN) return null;

  const created = await feishuApi("/docx/v1/documents", {
    method: "POST",
    token,
    body: {
      folder_token: FEISHU_DOC_FOLDER_TOKEN,
      title: digest.title,
    },
  });

  const documentId =
    created.document?.document_id ||
    created.document_id ||
    created.document?.token ||
    created.token;
  if (!documentId) throw new Error(`docx create succeeded but no document_id returned: ${JSON.stringify(created)}`);

  const rootBlockId = created.document?.block_id || created.block_id || documentId;
  const lines = digestPlainText(digest).split("\n");
  const children = lines.map((line) => ({
    block_type: 2,
    text: {
      elements: [{ text_run: { content: line || " " } }],
    },
  }));

  try {
    await feishuApi(`/docx/v1/documents/${documentId}/blocks/${rootBlockId}/children`, {
      method: "POST",
      token,
      body: { children, index: 0 },
    });
  } catch (error) {
    console.warn(`Feishu doc content append skipped: ${error.message}`);
  }

  return `飞书文档已创建：${documentId}`;
}

async function archiveDigest(digest) {
  if (!hasFeishuArchiveConfig()) return [];

  const results = [];
  let token;
  try {
    token = await getTenantAccessToken();
  } catch (error) {
    console.warn(`Feishu archive skipped: ${error.message}`);
    return [`归档失败：${trimText(error.message, 160)}`];
  }

  try {
    const bitableResult = await archiveDigestToBitable(digest, token);
    if (bitableResult) results.push(bitableResult);
  } catch (error) {
    console.warn(`Feishu bitable archive skipped: ${error.message}`);
    results.push(`多维表格归档失败：${trimText(error.message, 120)}`);
  }

  try {
    const docResult = await archiveDigestToDoc(digest, token);
    if (docResult) results.push(docResult);
  } catch (error) {
    console.warn(`Feishu doc archive skipped: ${error.message}`);
    results.push(`飞书文档归档失败：${trimText(error.message, 120)}`);
  }

  return results;
}

async function sendToFeishu(payload) {
  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Feishu webhook failed ${response.status}: ${text}`);
  }

  console.log(text);
}

function digestFooterParts(digest, archiveResults) {
  if (digest.mode === "official") {
    return [
      "仅整理官方一手来源：OpenAI、Anthropic、Google DeepMind、xAI/Grok。",
      digest.windowLabel ? `统计窗口：${digest.windowLabel}` : "",
      ...archiveResults,
    ].filter(Boolean);
  }

  return ["仅整理指定博主来源；不再混入媒体 RSS 或官网新闻。", ...archiveResults];
}

async function deliverDigest(digest) {
  const archiveResults = await archiveDigest(digest);
  const footerParts = digestFooterParts(digest, archiveResults);
  await sendToFeishu(buildPostMessage({ ...digest, footer: footerParts.join("\n"), archiveUrl: FEISHU_BITABLE_URL }));
}

async function sendJuyaDailyDigest() {
  const { feed, text } = await fetchFirstAvailable(JUYA_FEEDS);
  const digest = parseJuyaDaily(text);
  if (!digest || !digest.items.length) {
    throw new Error("橘鸦 RSS 可访问，但没有解析到早报要点");
  }
  if (!recentEnough(digest.published, 48)) {
    throw new Error(`橘鸦最新早报超过 48 小时未更新：${digest.published || "unknown date"}`);
  }

  await deliverDigest({
    mode: "daily",
    title: `橘鸦 AI 早报｜${digest.title}`,
    sourceName: sourceWithFeed(digest.sourceName, feed.name),
    sourceUrl: digest.link,
    date: todayInShanghai(),
    items: digest.items.slice(0, DAILY_MAX_ITEMS),
  });
}

async function sendProductJunWeeklyDigest() {
  const { feed, text } = await fetchFirstAvailable(PRODUCTJUN_FEEDS);
  const digest = await hydrateProductJunBilibiliDescription(parseProductJunWeekly(text));
  if (!digest) {
    throw new Error("产品君 RSS 可访问，但没有解析到视频内容");
  }
  if (!recentEnough(digest.published, PRODUCTJUN_MAX_AGE_HOURS)) {
    throw new Error(`产品君最近视频超过 ${PRODUCTJUN_MAX_AGE_HOURS} 小时未更新：${digest.published || "unknown date"}；最近可见视频为《${digest.title || "unknown title"}》`);
  }

  const items = digest.lines.length
    ? digest.lines.map((line) => ({ title: line, link: digest.link }))
    : [{ title: digest.title, link: digest.link }];

  await deliverDigest({
    mode: "weekly",
    title: `产品君 AI 周报｜${trimText(digest.title, 28)}`,
    sourceName: sourceWithFeed(digest.sourceName, feed.name),
    sourceUrl: digest.link,
    date: todayInShanghai(),
    items: items.slice(0, WEEKLY_MAX_ITEMS),
  });
}

async function sendOfficialDigest() {
  const window = officialDigestWindow(new Date(), DIGEST_DATE);
  const { items, errors, successCount } = await collectOfficialItems(window);

  if (!items.length) {
    await sendToFeishu(buildOfficialNoUpdateMessage({ window, errors, successCount }));
    return;
  }

  await deliverDigest({
    mode: "official",
    title: `官方 AI 一手动态｜${window.date}`,
    sourceName: "官方一手来源",
    sourceUrl: "",
    date: window.date,
    windowLabel: window.label,
    items: items.slice(0, OFFICIAL_MAX_ITEMS),
  });
}

async function main() {
  if (TEST_RUN) {
    await sendToFeishu(
      buildPostMessage({
        title: "AI 新闻测试",
        sourceName: "指定博主来源测试",
        sourceUrl: "https://daily.juya.uk/rss.xml",
        date: todayInShanghai(),
        items: [
          { title: "这里只会展示指定博主来源，不再混入媒体 RSS 或官网新闻", link: "https://daily.juya.uk/rss.xml" },
          { title: "输出格式已简化为标题、要点和原文链接", link: "https://daily.juya.uk/rss.xml" },
        ],
      }),
    );
    return;
  }

  if (DIGEST_MODE === "weekly") {
    try {
      await sendProductJunWeeklyDigest();
    } catch (error) {
      await sendToFeishu(buildUnavailableMessage({ mode: "weekly", sourceName: "产品君", error: error.message }));
    }
    return;
  }

  if (DIGEST_MODE === "official") {
    await sendOfficialDigest();
    return;
  }

  try {
    await sendJuyaDailyDigest();
  } catch (error) {
    await sendToFeishu(buildUnavailableMessage({ mode: "daily", sourceName: "橘鸦 AI 早报", error: error.message }));
  }
}

await main();
