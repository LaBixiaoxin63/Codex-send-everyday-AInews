const WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL;
const DRY_RUN = process.env.AI_NEWS_DRY_RUN === "1";

if (!WEBHOOK_URL && !DRY_RUN) {
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
  "Meta",
  "Reuters",
  "Bloomberg",
  "MIT Technology Review",
  "The Verge",
  "TechCrunch",
  "VentureBeat",
  "CNBC",
  "华尔街见闻",
  "机器之心",
  "量子位",
  "新智元",
  "36氪",
];

const topicRules = [
  {
    name: "智能体",
    pattern: /agent|agents|智能体|代理|assistant|workflow|browser|computer use/i,
    headline: "推进 AI 智能体和自动化能力",
    why: "值得关注它是否能真正减少重复劳动，而不只是演示效果。",
  },
  {
    name: "模型与产品",
    pattern: /gpt|gemini|claude|llama|model|模型|多模态|推理|发布|launch|release|unveil|debut/i,
    headline: "发布或更新 AI 模型与产品能力",
    why: "可能改变日常工具、开发流程和企业采购选择。",
  },
  {
    name: "算力与芯片",
    pattern: /nvidia|gpu|chip|semiconductor|data center|算力|芯片|数据中心|英伟达/i,
    headline: "算力、芯片或基础设施出现新动向",
    why: "这会影响 AI 服务成本、供给速度和创业公司的进入门槛。",
  },
  {
    name: "商业合作",
    pattern: /funding|raise|invest|partnership|acquire|acquisition|merger|融资|投资|合作|收购/i,
    headline: "AI 公司出现融资、合作或并购",
    why: "资本和合作方向通常能反映下一阶段的产业重点。",
  },
  {
    name: "监管与安全",
    pattern: /regulation|law|lawsuit|safety|copyright|privacy|policy|监管|法规|诉讼|版权|隐私|安全/i,
    headline: "AI 监管、安全或版权问题有新进展",
    why: "这类变化会直接影响产品能不能上线、怎么上线、谁来承担风险。",
  },
  {
    name: "人才与组织",
    pattern: /hire|joins|resign|founder|executive|karpathy|人才|加入|离职|创始人|高管/i,
    headline: "AI 行业出现关键人才或组织变化",
    why: "顶尖人才流向经常预示公司接下来会押注的方向。",
  },
];

function decodeEntities(text) {
  return text
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

function stripHtml(text) {
  return decodeEntities(String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function isMostlyEnglish(text) {
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  return letters > 20 && letters > cjk * 2;
}

function cleanNewsTitle(title) {
  return stripHtml(title)
    .replace(/\s+-\s+Google News$/iu, "")
    .replace(/\s+-\s+[^-｜|]+$/u, "")
    .replace(/\s*[｜|]\s*(Google News|CNBC|Reuters|VentureBeat|TechCrunch|The Verge|Bloomberg)$/iu, "")
    .replace(/\s+/g, " ")
    .trim();
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
    const title = stripHtml(firstMatch(block, /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/));
    const description = stripHtml(firstMatch(block, /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/));
    const link = firstMatch(block, /<link>([\s\S]*?)<\/link>/);
    const published = firstMatch(block, /<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceName = sourceMatch ? stripHtml(sourceMatch[2]) : "Google News";
    return { title, description, link, published, sourceName };
  });
}

function classifyItem(item) {
  const text = `${item.title} ${item.description} ${item.sourceName}`;
  return topicRules.find((rule) => rule.pattern.test(text)) || {
    name: "行业动态",
    headline: "AI 行业出现新的产品或市场动态",
    why: "可以作为判断技术趋势和机会变化的早期信号。",
  };
}

function extractCompanies(text) {
  const companies = [
    "OpenAI",
    "Anthropic",
    "Google",
    "DeepMind",
    "Microsoft",
    "Meta",
    "NVIDIA",
    "Apple",
    "Amazon",
    "xAI",
    "Mistral",
    "Perplexity",
  ];
  return companies.filter((name) => new RegExp(`\\b${name}\\b`, "i").test(text));
}

function displayTitle(item) {
  const title = cleanNewsTitle(item.title);
  if (!isMostlyEnglish(title)) return title;

  const topic = classifyItem(item);
  const companies = extractCompanies(`${item.title} ${item.description}`);
  const subject = companies.length ? companies.slice(0, 2).join(" / ") : "AI 行业";
  return `${subject}：${topic.headline}`;
}

function normalizeForCompare(text) {
  return stripHtml(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function trimText(text, maxLength) {
  const cleaned = stripHtml(text).replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1)}…`;
}

function buildSummary(item) {
  const description = stripHtml(item.description || "");
  const title = normalizeForCompare(cleanNewsTitle(item.title));
  const summary = normalizeForCompare(description);

  if (description && !isMostlyEnglish(description) && summary !== title && !summary.includes(title) && !title.includes(summary)) {
    return trimText(description, 110);
  }

  const topic = classifyItem(item);
  const companies = extractCompanies(`${item.title} ${item.description}`);
  const subject = companies.length ? companies.slice(0, 2).join(" / ") : item.sourceName;
  return `${subject} 相关消息：${topic.headline}。`;
}

function scoreItem(item) {
  const text = `${item.title} ${item.description} ${item.sourceName}`.toLowerCase();
  let score = 0;

  for (const source of sourcePriority) {
    if (text.includes(source.toLowerCase())) score += 5;
  }
  if (!isMostlyEnglish(item.title)) score += 4;
  if (/\b(openai|anthropic|gemini|deepmind|nvidia|microsoft|google|meta|xai)\b/i.test(text)) score += 3;
  if (/(发布|模型|智能体|监管|融资|合作|收购|芯片|launch|release|model|agent|regulation|funding|partnership|chip)/i.test(text)) score += 2;

  return score;
}

function pickItems(items, limit = 7) {
  const seen = new Set();
  return items
    .filter((item) => item.title && item.link)
    .sort((a, b) => scoreItem(b) - scoreItem(a))
    .filter((item) => {
      const key = cleanNewsTitle(item.title).toLowerCase().replace(/\W+/g, " ").slice(0, 80);
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

function buildHighlights(items) {
  const counts = new Map();
  for (const item of items) {
    const topic = classifyItem(item).name;
    counts.set(topic, (counts.get(topic) || 0) + 1);
  }

  const topTopics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);

  if (!topTopics.length) return "今日重点关注 AI 行业的新产品、商业化和监管动态。";
  return `今日重点：${topTopics.join("、")}。`;
}

function buildPost(items) {
  const content = [
    [
      {
        tag: "text",
        text: `AI 新闻早报｜${todayInShanghai()}\n${buildHighlights(items)}\n\n`,
      },
    ],
  ];

  items.forEach((item, index) => {
    const topic = classifyItem(item);
    content.push([
      {
        tag: "text",
        text: `${index + 1}. ${displayTitle(item)}\n要点：${buildSummary(item)}\n关注：${topic.why}\n`,
      },
      { tag: "a", text: "查看来源", href: item.link },
      { tag: "text", text: "\n\n" },
    ]);
  });

  content.push([
    {
      tag: "text",
      text: "说明：由 GitHub Actions 云端定时生成，电脑关机也可以运行。",
    },
  ]);

  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title: "AI 新闻早报",
          content,
        },
      },
    },
  };
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

async function main() {
  if (process.env.AI_NEWS_TEST === "1") {
    await sendToFeishu(buildPost([
      {
        title: "OpenAI releases a new model for coding agents - Example News",
        description: "This is a test item generated by the same script that sends the daily digest.",
        link: "https://github.com/features/actions",
        sourceName: "GitHub Actions",
      },
      {
        title: "Anthropic 发布企业级 AI 智能体能力",
        description: "新能力面向企业工作流，强调工具调用、安全控制和团队协作场景。",
        link: "https://github.com/features/actions",
        sourceName: "Example News",
      },
    ]));
    return;
  }

  const responses = await Promise.all(
    feeds.map(async (url) => {
      const response = await fetch(url, {
        headers: { "user-agent": "ai-news-feishu-digest/2.0" },
      });
      if (!response.ok) throw new Error(`Feed failed ${response.status}: ${url}`);
      return response.text();
    }),
  );

  const items = pickItems(responses.flatMap(parseFeed));
  if (!items.length) throw new Error("No AI news items found.");

  await sendToFeishu(buildPost(items));
}

await main();
