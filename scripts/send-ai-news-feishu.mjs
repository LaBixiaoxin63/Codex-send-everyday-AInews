const WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  throw new Error("Missing FEISHU_WEBHOOK_URL environment variable.");
}

const feeds = [
  "https://news.google.com/rss/search?q=%28AI%20OR%20%22artificial%20intelligence%22%20OR%20OpenAI%20OR%20Anthropic%20OR%20Gemini%29%20when%3A1d&hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans",
  "https://news.google.com/rss/search?q=%28AI%20OR%20%22artificial%20intelligence%22%29%20%28OpenAI%20OR%20Google%20OR%20Microsoft%20OR%20Meta%20OR%20Nvidia%20OR%20Anthropic%29%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen",
];

const sourcePriority = [
  "OpenAI",
  "Anthropic",
  "Google",
  "Microsoft",
  "NVIDIA",
  "Reuters",
  "The Verge",
  "TechCrunch",
  "MIT Technology Review",
  "VentureBeat",
  "Bloomberg",
  "CNBC",
];

function decodeEntities(text) {
  return text
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function stripHtml(text) {
  return decodeEntities(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function firstMatch(block, pattern) {
  const match = block.match(pattern);
  if (!match) return "";
  const value = match.slice(1).find((group) => group !== undefined) || "";
  return decodeEntities(value.trim());
}

function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, block]) => {
    const sourceMatch = block.match(/<source\b[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/);
    const title = stripHtml(firstMatch(block, /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/).replace(" - ", "｜"));
    const description = stripHtml(firstMatch(block, /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/));
    const link = firstMatch(block, /<link>([\s\S]*?)<\/link>/);
    const published = firstMatch(block, /<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceName = sourceMatch ? stripHtml(sourceMatch[2]) : "Google News";
    return { title, description, link, published, sourceName };
  });
}

function scoreItem(item) {
  const text = `${item.title} ${item.description} ${item.sourceName}`.toLowerCase();
  let score = 0;
  for (const source of sourcePriority) {
    if (text.includes(source.toLowerCase())) score += 5;
  }
  if (/\b(openai|anthropic|gemini|deepmind|nvidia|microsoft|google|meta)\b/i.test(text)) score += 3;
  if (/\b(launch|release|model|chip|regulation|funding|partnership|agent|safety|发布|模型|监管|融资|合作|芯片)\b/i.test(text)) score += 2;
  return score;
}

function pickItems(items, limit = 7) {
  const seen = new Set();
  return items
    .filter((item) => item.title && item.link)
    .sort((a, b) => scoreItem(b) - scoreItem(a))
    .filter((item) => {
      const key = item.title.toLowerCase().replace(/\W+/g, " ").slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildPost(items) {
  const content = [
    [{ tag: "text", text: `AI新闻｜${todayInShanghai()}\n\n` }],
  ];

  items.forEach((item, index) => {
    const summary = summarizeItem(item);
    content.push([
      { tag: "text", text: `${index + 1}. ${item.title}\n${summary ? `${summary}\n` : ""}` },
      { tag: "a", text: "来源", href: item.link },
    ]);
  });

  content.push([
    { tag: "text", text: "\n提示：这是 GitHub Actions 云端测试版，电脑关机也可以运行。" },
  ]);

  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title: "AI新闻 午间摘要",
          content,
        },
      },
    },
  };
}

function normalizeForCompare(text) {
  return stripHtml(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function summarizeItem(item) {
  const description = stripHtml(item.description || "");
  if (!description) return "";

  const title = normalizeForCompare(item.title);
  const summary = normalizeForCompare(description);
  if (!summary || summary === title || summary.includes(title) || title.includes(summary)) {
    return "";
  }

  return description.slice(0, 180);
}

async function main() {
  if (process.env.AI_NEWS_TEST === "1") {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(buildPost([
        {
          title: "云端定时任务测试",
          description: "这条消息使用 GitHub Actions 同款脚本生成，证明 Webhook 发送链路可用。正式运行时会替换为过去 24 小时的 AI 新闻。",
          link: "https://github.com/features/actions",
          sourceName: "GitHub Actions",
        },
      ])),
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`Feishu webhook failed ${response.status}: ${text}`);
    console.log(text);
    return;
  }

  const responses = await Promise.all(
    feeds.map(async (url) => {
      const response = await fetch(url, {
        headers: { "user-agent": "ai-news-feishu-digest/1.0" },
      });
      if (!response.ok) throw new Error(`Feed failed ${response.status}: ${url}`);
      return response.text();
    }),
  );

  const items = pickItems(responses.flatMap(parseFeed));
  if (!items.length) throw new Error("No AI news items found.");

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(buildPost(items)),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Feishu webhook failed ${response.status}: ${text}`);
  }

  console.log(text);
}

await main();
