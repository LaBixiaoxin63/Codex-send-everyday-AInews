const WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL;
const DRY_RUN = process.env.AI_NEWS_DRY_RUN === "1";
const TEST_RUN = process.env.AI_NEWS_TEST === "1";
const DIGEST_MODE = process.env.AI_NEWS_MODE || "daily";
const FEED_TIMEOUT_MS = Number.parseInt(process.env.AI_NEWS_FEED_TIMEOUT_MS || "20000", 10);
const PRODUCTJUN_MAX_AGE_HOURS = Number.parseInt(process.env.AI_NEWS_PRODUCTJUN_MAX_AGE_HOURS || "72", 10);
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || "";
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || "";
const FEISHU_BITABLE_APP_TOKEN = process.env.FEISHU_BITABLE_APP_TOKEN || "";
const FEISHU_BITABLE_TABLE_ID = process.env.FEISHU_BITABLE_TABLE_ID || "";
const FEISHU_DOC_FOLDER_TOKEN = process.env.FEISHU_DOC_FOLDER_TOKEN || "";

const DAILY_MAX_ITEMS = Number.parseInt(process.env.AI_NEWS_DAILY_LIMIT || "8", 10);
const WEEKLY_MAX_ITEMS = Number.parseInt(process.env.AI_NEWS_WEEKLY_LIMIT || "10", 10);

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

function buildPostMessage({ title, sourceName, sourceUrl, date, items, footer }) {
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

function sourceWithFeed(sourceName, feedName) {
  return sourceName === feedName ? sourceName : `${sourceName}（${feedName}）`;
}

function hasFeishuArchiveConfig() {
  return Boolean(FEISHU_APP_ID && FEISHU_APP_SECRET && (FEISHU_BITABLE_APP_TOKEN || FEISHU_DOC_FOLDER_TOKEN));
}

async function getTenantAccessToken() {
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`tenant_access_token failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data.tenant_access_token;
}

async function feishuApi(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`https://open.feishu.cn/open-apis${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok || data.code !== 0) {
    throw new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data.data || {};
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

  const records = digest.items.map((item, index) => ({
    fields: {
      日期: digest.date,
      类型: digest.mode === "weekly" ? "周报" : "日报",
      序号: String(index + 1),
      标题: item.title,
      分类: item.category || "",
      来源: digest.sourceName,
      原文链接: item.link || digest.sourceUrl || "",
      发布标题: digest.title,
      原始发布: digest.sourceUrl || "",
      归档时间: nowInShanghai(),
    },
  }));

  if (!records.length) return null;

  await feishuApi(
    `/bitable/v1/apps/${FEISHU_BITABLE_APP_TOKEN}/tables/${FEISHU_BITABLE_TABLE_ID}/records/batch_create`,
    { method: "POST", token, body: { records } },
  );

  return `多维表格已写入 ${records.length} 条`;
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

async function deliverDigest(digest) {
  const archiveResults = await archiveDigest(digest);
  const footerParts = ["仅整理指定博主来源；不再混入媒体 RSS 或官网新闻。", ...archiveResults];
  await sendToFeishu(buildPostMessage({ ...digest, footer: footerParts.join("\n") }));
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

  try {
    await sendJuyaDailyDigest();
  } catch (error) {
    await sendToFeishu(buildUnavailableMessage({ mode: "daily", sourceName: "橘鸦 AI 早报", error: error.message }));
  }
}

await main();
