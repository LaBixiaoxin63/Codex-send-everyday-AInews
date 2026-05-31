const WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL;
const DRY_RUN = process.env.AI_NEWS_DRY_RUN === "1";
const MIN_SIGNAL_SCORE = Number.parseInt(process.env.AI_NEWS_MIN_SCORE || "6", 10);
const GLOBAL_DIGEST_LIMIT = Number.parseInt(process.env.AI_NEWS_GLOBAL_LIMIT || "8", 10);
const DOMESTIC_DIGEST_LIMIT = Number.parseInt(process.env.AI_NEWS_DOMESTIC_LIMIT || "8", 10);
const DAILY_DIGEST_LIMIT = Number.parseInt(process.env.AI_NEWS_DAILY_LIMIT || "16", 10);
const WEEKLY_DIGEST_LIMIT = Number.parseInt(process.env.AI_NEWS_WEEKLY_LIMIT || "8", 10);
const FEED_TIMEOUT_MS = Number.parseInt(process.env.AI_NEWS_FEED_TIMEOUT_MS || "20000", 10);
const DIGEST_SCOPE = process.env.AI_NEWS_SCOPE || "all";
const DIGEST_MODE = process.env.AI_NEWS_MODE || "daily";
const PRODUCTJUN_WEEKLY_FEED = {
  name: "产品君 Bilibili RSS",
  url: "https://hub.vincentxue.com/bilibili/user/video/1845434732",
};

if (!WEBHOOK_URL && !DRY_RUN) {
  throw new Error("Missing FEISHU_WEBHOOK_URL environment variable.");
}

const feedDefinitions = [
  { name: "橘鸦 AI 早报 RSS", url: "https://imjuya.github.io/juya-ai-daily/rss.xml" },
  {
    name: "Google News CN global",
    url: "https://news.google.com/rss/search?q=%28AI%20OR%20%22artificial%20intelligence%22%20OR%20OpenAI%20OR%20Anthropic%20OR%20Gemini%29%20when%3A1d&hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans",
  },
  {
    name: "Google News EN major labs",
    url: "https://news.google.com/rss/search?q=%28AI%20OR%20%22artificial%20intelligence%22%29%20%28OpenAI%20OR%20Google%20OR%20Microsoft%20OR%20Meta%20OR%20Nvidia%20OR%20Anthropic%29%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen",
  },
  {
    name: "Google News EN models/tools",
    url: "https://news.google.com/rss/search?q=%28AI%20OR%20LLM%20OR%20%22large%20language%20model%22%29%20%28model%20OR%20agent%20OR%20coding%20OR%20opensource%20OR%20%22open%20source%22%20OR%20release%29%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen",
  },
  {
    name: "Google News CN models/tools",
    url: "https://news.google.com/rss/search?q=%28%E5%A4%A7%E6%A8%A1%E5%9E%8B%20OR%20AI%20OR%20%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD%29%20%28%E5%BC%80%E6%BA%90%20OR%20%E6%A8%A1%E5%9E%8B%20OR%20%E6%99%BA%E8%83%BD%E4%BD%93%20OR%20%E7%BC%96%E7%A8%8B%20OR%20%E5%A4%9A%E6%A8%A1%E6%80%81%20OR%20%E5%8F%91%E5%B8%83%29%20when%3A1d&hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans",
  },
  {
    name: "Google News CN domestic labs",
    url: "https://news.google.com/rss/search?q=%28DeepSeek%20OR%20Qwen%20OR%20%E9%80%9A%E4%B9%89%E5%8D%83%E9%97%AE%20OR%20Kimi%20OR%20%E6%9C%88%E4%B9%8B%E6%9A%97%E9%9D%A2%20OR%20%E6%99%BA%E8%B0%B1%20OR%20%E8%B1%86%E5%8C%85%20OR%20%E9%98%B6%E8%B7%83%E6%98%9F%E8%BE%B0%20OR%20MiniMax%20OR%20%E7%99%BE%E5%BA%A6%20OR%20%E9%98%BF%E9%87%8C%20OR%20%E8%85%BE%E8%AE%AF%20OR%20%E5%8D%8E%E4%B8%BA%29%20%28AI%20OR%20%E5%A4%A7%E6%A8%A1%E5%9E%8B%20OR%20%E6%99%BA%E8%83%BD%E4%BD%93%20OR%20%E5%A4%9A%E6%A8%A1%E6%80%81%20OR%20%E5%BC%80%E6%BA%90%29%20when%3A1d&hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans",
  },
  {
    name: "Bing News CN domestic labs",
    url: "https://www.bing.com/news/search?q=%28DeepSeek%20OR%20Qwen%20OR%20Kimi%20OR%20%E6%99%BA%E8%B0%B1%20OR%20%E8%B1%86%E5%8C%85%20OR%20MiniMax%20OR%20%E9%98%BF%E9%87%8C%20OR%20%E7%99%BE%E5%BA%A6%20OR%20%E8%85%BE%E8%AE%AF%20OR%20%E5%8D%8E%E4%B8%BA%29%20%28AI%20OR%20%E5%A4%A7%E6%A8%A1%E5%9E%8B%20OR%20%E6%99%BA%E8%83%BD%E4%BD%93%29&format=rss&setlang=zh-CN&cc=CN",
  },
  { name: "量子位 RSS", url: "https://www.qbitai.com/feed" },
  { name: "IT之家 RSS", url: "https://www.ithome.com/rss/" },
  { name: "InfoQ RSS", url: "https://www.infoq.cn/feed" },
  { name: "36氪 RSS", url: "https://36kr.com/feed" },
  { name: "DeepSeek GitHub releases", url: "https://github.com/deepseek-ai/DeepSeek-V3/releases.atom" },
  { name: "Qwen GitHub releases", url: "https://github.com/QwenLM/Qwen3/releases.atom" },
  { name: "GLM GitHub releases", url: "https://github.com/THUDM/GLM-4/releases.atom" },
];

const activeFeeds = feedDefinitions.map((feed) => ({
  ...feed,
  url: DIGEST_MODE === "weekly" ? feed.url.replaceAll("when%3A1d", "when%3A7d") : feed.url,
}));

const sourcePriority = [
  "橘鸦 AI 早报",
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
  "Hugging Face",
  "GitHub",
  "Product Hunt",
  "arXiv",
  "DeepSeek",
  "Qwen",
  "Kimi",
  "通义千问",
  "月之暗面",
  "智谱",
  "豆包",
  "MiniMax",
  "阶跃星辰",
  "百度",
  "阿里",
  "腾讯",
  "华为",
  "字节跳动",
  "华尔街见闻",
  "机器之心",
  "量子位",
  "新智元",
  "36氪",
  "IT之家",
  "雷峰网",
  "虎嗅",
  "极客公园",
  "InfoQ",
  "晚点",
  "澎湃新闻",
  "财新",
  "第一财经",
];

const domesticSubjects = [
  "DeepSeek",
  "Qwen",
  "千问",
  "千问云",
  "Kimi",
  "MiniMax",
  "通义千问",
  "月之暗面",
  "智谱",
  "智谱AI",
  "豆包",
  "阶跃星辰",
  "百度",
  "飞桨",
  "文心",
  "文心一言",
  "ERNIE",
  "阿里",
  "Alibaba",
  "腾讯",
  "Tencent",
  "华为",
  "Huawei",
  "鸿蒙",
  "深开鸿",
  "字节跳动",
  "ByteDance",
  "美团",
  "Meituan",
  "火山引擎",
  "商汤",
  "SenseTime",
  "科大讯飞",
  "iFlytek",
  "讯飞星火",
  "昆仑万维",
  "天工",
  "零一万物",
  "01.AI",
  "百川智能",
  "Baichuan",
  "面壁智能",
  "ModelBest",
  "摩尔线程",
  "寒武纪",
  "沐曦",
  "壁仞",
  "燧原",
  "平头哥",
];

const domesticSources = [
  "华尔街见闻",
  "机器之心",
  "量子位",
  "新智元",
  "36氪",
  "36kr",
  "IT之家",
  "雷峰网",
  "虎嗅",
  "极客公园",
  "InfoQ",
  "晚点",
  "澎湃新闻",
  "财新",
  "第一财经",
];

const domesticContextTerms = [
  "中国",
  "国内",
  "国产",
  "我国",
  "北京",
  "上海",
  "深圳",
  "杭州",
  "广州",
  "亦庄",
  "中关村",
  "长三角",
  "粤港澳",
  "工信部",
  "网信办",
  "AICon上海",
  "北京亦庄",
  "2026AI Partner",
  "全国",
];

const aiTopicTerms =
  /(\bAI\b|\bAIGC\b|\bAGI\b|\bLLM\b|\bGPU\b|\bagent\b|\bagents\b|\bdata center\b|大模型|人工智能|生成式|智能体|多模态|算力|芯片|推理|模型|机器学习|深度学习|自动驾驶|具身智能|机器人)/i;

const technicalProgressTerms =
  /(\bAPI\b|\bSDK\b|\bCLI\b|\bIDE\b|\bMCP\b|\bAgent\b|\bagent\b|\bbenchmark\b|发布|推出|上线|更新|升级|开源|闭源|版本|迭代|接入|适配|部署|训练|推理|评测|基准|模型|大模型|多模态|智能体|工具|产品|应用|插件|平台|框架|系统|芯片|算力|融资|投资|量产|商用|降价|涨价|价格)/i;

const softContentTerms =
  /(对话|访谈|专访|圆桌|观点|评论|复盘|回顾|盘点|手记|观察|演讲|分享|大会|论坛|嘉宾|人物|为什么|怎么看|什么才是|会是谁|手册|替代不了|离开)/i;

const hardEventTerms =
  /(发布|推出|上线|更新|升级|开源|版本|接入|适配|融资|投资|收购|合作|量产|商用|降价|涨价|突破|上线|开测|内测|公测)/i;

const productReleaseTerms =
  /(发布|推出|上线|更新|升级|开源|版本|接入|适配|模型|大模型|工具|智能体|Agent|API|SDK|CLI|插件|框架|系统|推理|多模态|芯片|算力|降价|价格)/i;

const inherentlyAiSubjects = [
  "OpenAI",
  "Anthropic",
  "Gemini",
  "Claude",
  "GPT",
  "DeepSeek",
  "Qwen",
  "千问",
  "千问云",
  "Kimi",
  "MiniMax",
  "通义千问",
  "月之暗面",
  "智谱",
  "豆包",
  "阶跃星辰",
  "文心",
  "文心一言",
  "ERNIE",
  "飞桨",
  "讯飞星火",
  "天工",
  "Baichuan",
  "百川智能",
  "ModelBest",
  "面壁智能",
];

const foreignSubjects =
  /\b(OpenAI|Anthropic|Google|DeepMind|Microsoft|Meta|NVIDIA|Apple|Amazon|xAI|Mistral|Perplexity|Gemini|Claude|GPT|Llama)\b/i;

const topicRules = [
  {
    name: "编程工具",
    pattern: /codex|cursor|codebuddy|qoder|github copilot|coding|developer|ide|cli|编程|代码|开发者|编辑器/i,
    headline: "AI 编程和开发工具更新",
    why: "开发工具的变化会很快影响真实工作流，值得优先试用或观察。",
  },
  {
    name: "智能体",
    pattern: /agent|agents|智能体|代理|assistant|workflow|browser|computer use/i,
    headline: "推进 AI 智能体和自动化能力",
    why: "值得关注它是否能真正减少重复劳动，而不只是演示效果。",
  },
  {
    name: "多模态生成",
    pattern: /video|image|audio|voice|tts|music|multimodal|omni|视觉|图像|视频|音频|语音|多模态|文生图|文生视频/i,
    headline: "多模态生成能力有新进展",
    why: "图像、视频和音频能力会直接影响内容生产、设计和营销场景。",
  },
  {
    name: "模型与产品",
    pattern: /gpt|gemini|claude|llama|qwen|deepseek|grok|glm|mistral|model|模型|推理|发布|launch|release|unveil|debut/i,
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
    name: "开源生态",
    pattern: /open source|opensource|github|hugging face|开源|权重|仓库|repo|gguf|benchmark|基准/i,
    headline: "开源模型或工具生态更新",
    why: "开源进展通常意味着更低使用门槛，也更容易被开发者快速复用。",
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
  const channelTitle = stripHtml(firstMatch(xml, /<channel>[\s\S]*?<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/));
  const atomTitle = stripHtml(firstMatch(xml, /<feed[\s\S]*?<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<feed[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/));
  const feedTitle = channelTitle || atomTitle || "来源报道";

  const rssItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, block]) => {
    const sourceMatch = block.match(/<source\b[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/);
    const title = stripHtml(firstMatch(block, /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/));
    const description = stripHtml(firstMatch(block, /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/));
    const link = firstMatch(block, /<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>|<link>([\s\S]*?)<\/link>/);
    const published = firstMatch(block, /<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceName = sourceMatch ? stripHtml(sourceMatch[2]) : feedTitle;
    return { title, description, link, published, sourceName };
  });

  const atomEntries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].map(([, block]) => {
    const title = stripHtml(firstMatch(block, /<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title[^>]*>([\s\S]*?)<\/title>/));
    const description = stripHtml(firstMatch(block, /<summary[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/summary>|<summary[^>]*>([\s\S]*?)<\/summary>|<content[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/content>|<content[^>]*>([\s\S]*?)<\/content>/));
    const link =
      firstMatch(block, /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/) ||
      firstMatch(block, /<link\b[^>]*href=["']([^"']+)["'][^>]*>/);
    const published = firstMatch(block, /<published[^>]*>([\s\S]*?)<\/published>|<updated[^>]*>([\s\S]*?)<\/updated>/);
    return { title, description, link, published, sourceName: feedTitle };
  });

  return [...rssItems, ...atomEntries];
}

function parseJuyaDigestFeed(xml) {
  const latestItem = firstMatch(xml, /<item>([\s\S]*?)<\/item>/);
  const published = firstMatch(latestItem, /<pubDate>([\s\S]*?)<\/pubDate>/);
  const content = firstMatch(latestItem, /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);
  const overview = firstMatch(content, /<h2>概览<\/h2>([\s\S]*?)<hr>/);
  const items = [];

  for (const section of overview.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<ul>([\s\S]*?)<\/ul>/g)) {
    const category = stripHtml(section[1]);
    for (const match of section[2].matchAll(/<li>([\s\S]*?)<a href="([^"]+)">↗<\/a>[\s\S]*?<\/li>/g)) {
      items.push({
        title: stripHtml(match[1]),
        description: "",
        link: decodeEntities(match[2]),
        published,
        sourceName: `橘鸦 AI 早报｜${category}`,
      });
    }
  }

  return items;
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
    ...domesticSubjects,
  ];
  return companies.filter((name) => {
    if (/[\u3400-\u9fff]/u.test(name)) return text.includes(name);
    return new RegExp(`\\b${name}\\b`, "i").test(text);
  });
}

function includesAnyName(text, names) {
  return names.some((name) => {
    if (/[\u3400-\u9fff]/u.test(name)) return text.includes(name);
    return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
  });
}

function isLowSignalRoundup(item) {
  const title = cleanNewsTitle(item.title);
  return /^(9点1氪|8点1氪|36氪晚报|早报|晚报|每日)/.test(title) && !aiTopicTerms.test(title) && !includesAnyName(title, inherentlyAiSubjects);
}

function isTechnicalProgressItem(item) {
  const title = cleanNewsTitle(item.title);
  const text = `${title} ${item.description}`;
  const fullText = `${text} ${item.sourceName}`;
  const isOfficialRelease = /release notes|releases|github/i.test(item.sourceName) && includesAnyName(fullText, domesticSubjects);
  if (isOfficialRelease) return true;

  const hasHardEvent = hardEventTerms.test(title);
  const hasTechnicalSignal = technicalProgressTerms.test(title) || includesAnyName(title, inherentlyAiSubjects);
  const hasTechnicalContext = technicalProgressTerms.test(text) || includesAnyName(fullText, inherentlyAiSubjects);
  const isSoftContent = softContentTerms.test(title);

  if (isSoftContent && !hasHardEvent) return false;
  return hasTechnicalSignal || (hasHardEvent && hasTechnicalContext);
}

function technicalProgressRank(item) {
  const title = cleanNewsTitle(item.title);
  const fullText = `${title} ${item.description} ${item.sourceName}`;
  let rank = 0;

  if (/release notes|releases|github/i.test(item.sourceName)) rank += 8;
  if (includesAnyName(title, domesticSubjects) || includesAnyName(title, inherentlyAiSubjects)) rank += 8;
  if (/(发布|推出|上线|更新|升级|开源|版本|接入|适配|开测|内测|公测|降价|价格)/i.test(title)) rank += 7;
  if (/(模型|大模型|智能体|工具|API|SDK|CLI|插件|平台|框架|系统|操作系统|芯片|算力|Code|云)/i.test(title)) rank += 5;
  if (includesAnyName(fullText, ["DeepSeek", "Qwen", "千问", "Kimi", "通义千问", "豆包", "月之暗面", "智谱"])) rank += 3;
  if (/(融资|投资|估值|资本|首发)/i.test(title) && !/(发布|推出|上线|更新|升级|开源|版本|接入|适配|模型|工具|系统|芯片|Code)/i.test(title)) rank -= 5;
  if (softContentTerms.test(title)) rank -= 10;

  return rank;
}

function isAiNewsItem(item) {
  if (isLowSignalRoundup(item)) return false;

  const title = item.title || "";
  const text = `${title} ${item.description}`;
  const fullText = `${text} ${item.sourceName}`;
  const titleRelevant = aiTopicTerms.test(title) || includesAnyName(title, inherentlyAiSubjects);
  const fullRelevant = aiTopicTerms.test(text) || includesAnyName(fullText, inherentlyAiSubjects);

  if (isDomesticSource(item)) return titleRelevant;
  return fullRelevant;
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

const compareStopWords = new Set([
  "ai",
  "artificial",
  "intelligence",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "news",
  "says",
  "said",
  "will",
  "about",
  "after",
  "over",
  "new",
  "最新",
  "新闻",
  "报道",
  "消息",
  "宣布",
  "发布",
  "称",
  "与",
  "和",
  "的",
  "了",
  "在",
  "将",
  "为",
  "对",
  "中",
  "人工智能",
]);

function itemCompareText(item) {
  return normalizeForCompare(`${cleanNewsTitle(item.title)} ${item.description} ${item.sourceName}`);
}

function contentTokens(item) {
  const text = itemCompareText(item);
  const latinTokens = text
    .split(/\s+/)
    .filter((token) => /^[a-z0-9]+$/i.test(token))
    .filter((token) => token.length >= 2 && !compareStopWords.has(token));
  const cjkText = [...text].filter((char) => /[\u3400-\u9fff]/u.test(char)).join("");
  const cjkTokens = [];

  for (let index = 0; index < cjkText.length - 1; index += 1) {
    const token = cjkText.slice(index, index + 2);
    if (!compareStopWords.has(token)) cjkTokens.push(token);
  }

  return [...latinTokens, ...cjkTokens].slice(0, 120);
}

function contentFingerprint(item) {
  const topic = classifyItem(item).name;
  const companies = extractCompanies(`${item.title} ${item.description}`).map((name) => name.toLowerCase()).sort();
  const tokens = contentTokens(item).filter((token) => token.length >= 4).slice(0, 8).sort();
  return `${topic}:${companies.join(",")}:${tokens.join(",")}`;
}

function tokenOverlapScore(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;

  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  return intersection / Math.min(a.size, b.size);
}

function sameNewsEvent(a, b) {
  const aCompanies = extractCompanies(`${a.title} ${a.description}`).map((name) => name.toLowerCase()).sort();
  const bCompanies = extractCompanies(`${b.title} ${b.description}`).map((name) => name.toLowerCase()).sort();
  const sharedCompanies = aCompanies.filter((name) => bCompanies.includes(name));
  const sameTopic = classifyItem(a).name === classifyItem(b).name;

  const aText = itemCompareText(a);
  const bText = itemCompareText(b);
  if (aText && bText && (aText.includes(bText) || bText.includes(aText))) return true;

  const overlap = tokenOverlapScore(contentTokens(a), contentTokens(b));
  if (sharedCompanies.length && sameTopic && overlap >= 0.42) return true;
  if (sharedCompanies.length >= 2 && overlap >= 0.34) return true;
  return sameTopic && overlap >= 0.58;
}

function trimText(text, maxLength) {
  const cleaned = stripHtml(text).replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1)}…`;
}

function compactTitle(item, maxLength = 36) {
  return trimText(displayTitle(item), maxLength);
}

function buildLead(item) {
  const topic = classifyItem(item);
  const companies = extractCompanies(`${item.title} ${item.description}`);
  const subject = companies.length ? companies.slice(0, 2).join(" / ") : sourceLabel(item);
  const description = stripHtml(item.description || "");

  if (description && !isMostlyEnglish(description)) {
    return trimText(description, 72);
  }

  return trimText(`${subject}：${topic.headline}，这条更适合先知道结论再决定是否点开。`, 72);
}

function scoreItem(item) {
  if (!isAiNewsItem(item)) return 0;

  const text = `${item.title} ${item.description} ${item.sourceName}`.toLowerCase();
  const sourceText = `${item.sourceName} ${item.link}`.toLowerCase();
  let score = 0;

  for (const source of sourcePriority) {
    const sourceName = source.toLowerCase();
    if (sourceText.includes(sourceName)) score += 6;
    else if (text.includes(sourceName)) score += 2;
  }
  if (!isMostlyEnglish(item.title)) score += 4;
  if (/\b(openai|anthropic|gemini|deepmind|nvidia|microsoft|google|meta|xai|deepseek|qwen|kimi|minimax)\b/i.test(text)) score += 3;
  if (/(通义千问|月之暗面|智谱|豆包|阶跃星辰|百度|阿里|腾讯|华为|字节跳动|火山引擎)/i.test(text)) score += 3;
  if (isDomesticItem(item)) score += 2;
  if (isDomesticSource(item)) score += 1;
  if (isTechnicalProgressItem(item)) score += 3;
  if (productReleaseTerms.test(cleanNewsTitle(item.title))) score += 4;
  if (softContentTerms.test(cleanNewsTitle(item.title))) score -= 4;
  if (aiTopicTerms.test(text)) score += 2;
  if (/(发布|监管|融资|合作|收购|开源|launch|release|regulation|funding|partnership)/i.test(text)) score += 2;

  return score;
}

function impactLevel(item) {
  const score = scoreItem(item);
  if (score >= 16) return "S 级｜高影响";
  if (score >= 12) return "A 级｜重要";
  if (score >= 8) return "B 级｜值得关注";
  return "C 级｜观察";
}

function sourceLabel(item) {
  return item.sourceName && item.sourceName !== "Google News" ? item.sourceName : "来源报道";
}

function categoryLabel(item) {
  if (item.sourceName.startsWith("橘鸦 AI 早报｜")) return item.sourceName.split("｜")[1];
  return classifyItem(item).name;
}

function isDomesticItem(item) {
  if (!isAiNewsItem(item)) return false;

  const text = `${item.title} ${item.description}`;
  const fullText = `${text} ${item.sourceName}`;
  const hasDomesticSubject = includesAnyName(fullText, domesticSubjects);
  if (hasDomesticSubject) return true;

  const hasDomesticContext = domesticContextTerms.some((term) => fullText.includes(term));
  const hasForeignSubject = foreignSubjects.test(text);
  return isDomesticSource(item) && aiTopicTerms.test(text) && hasDomesticContext && !hasForeignSubject;
}

function isDomesticSource(item) {
  return domesticSources.some((name) => item.sourceName.includes(name));
}

function buildDigestName(scope) {
  if (scope === "global") return "AI早报｜全球篇";
  if (scope === "domestic") return "AI早报｜国内篇";
  return "AI早报";
}

function buildTopLine(items, scope = "all") {
  if (!items.length) return `过去 24 小时没有筛出足够值得单独展开的${scope === "domestic" ? "国内" : scope === "global" ? "全球" : ""} AI 新闻。`;

  const top = items[0];
  const second = items[1];
  if (!second) return `今天先看这一条：${compactTitle(top, 34)}。`;
  return `今天先看：${compactTitle(top, 28)}；另外关注 ${compactTitle(second, 24)}。`;
}

function buildOverview(items) {
  if (!items.length) return "概览\n- 今天没有足够高信号的 AI 新闻，先不硬凑条数。";
  const groups = new Map();
  items.forEach((item, index) => {
    const topic = categoryLabel(item);
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic).push(`- ${compactTitle(item, 42)} #${index + 1}`);
  });

  return `概览\n${[...groups.entries()]
    .map(([topic, lines]) => `【${topic}】\n${lines.join("\n")}`)
    .join("\n")}`;
}

function buildWeeklyTheme(items) {
  if (!items.length) return "这一周没有筛出足够高信号的 AI 大事，先不硬凑看点。";

  const topicCounts = new Map();
  for (const item of items) {
    const topic = classifyItem(item).name;
    topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
  }
  const topTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);

  return `这一周最值得看的是：${topTopics.join("、")}。`;
}

function buildWeeklyPost(items) {
  const content = [
    [
      {
        tag: "text",
        text: `本周AI大事看点｜${todayInShanghai()}\n${buildWeeklyTheme(items)}\n\n`,
      },
    ],
  ];

  items.forEach((item, index) => {
    const topic = classifyItem(item);
    content.push([
      {
        tag: "text",
        text: `${index + 1}. ${displayTitle(item)}\n发生了什么：${buildLead(item)}\n为什么重要：${topic.why}\n适合关注：${topic.name}｜${impactLevel(item)}\n`,
      },
      { tag: "a", text: "原始链接", href: item.link },
      { tag: "text", text: "\n\n" },
    ]);
  });

  content.push([
    {
      tag: "text",
      text: "说明：本周看点按公开来源自动整理，优先保留模型、工具、产品、开源、算力、监管和商业化等硬进展；重复事件只保留一条。",
    },
  ]);

  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title: items.length ? `本周AI大事看点：${compactTitle(items[0], 20)}` : "本周AI大事看点：暂无高信号事件",
          content,
        },
      },
    },
  };
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

function productJunDescriptionLines(description) {
  return decodeEntitiesDeep(description)
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "\n")
    .replace(/<img\b[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function parseProductJunWeeklyDigest(xml) {
  const weekMs = 8 * 24 * 60 * 60 * 1000;
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, block]) => {
      const title = stripHtml(firstMatch(block, /<title>([\s\S]*?)<\/title>/));
      const description = firstMatch(block, /<description>([\s\S]*?)<\/description>/);
      const link = firstMatch(block, /<link>([\s\S]*?)<\/link>/);
      const published = firstMatch(block, /<pubDate>([\s\S]*?)<\/pubDate>/);
      return {
        title,
        lines: productJunDescriptionLines(description),
        link,
        published,
      };
    })
    .filter((item) => /盘点一周AI大事/i.test(item.title))
    .filter((item) => item.link && item.lines.length)
    .filter((item) => {
      const publishedAt = Date.parse(item.published);
      return Number.isFinite(publishedAt) && Date.now() - publishedAt < weekMs;
    })
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))[0];
}

function buildProductJunWeeklyPost(digest) {
  const content = [
    [
      {
        tag: "text",
        text: `本周AI大事看点｜${todayInShanghai()}\n根据产品君本周视频整理\n${digest.title}\n\n`,
      },
    ],
  ];

  digest.lines.forEach((line, index) => {
    content.push([{ tag: "text", text: `${index + 1}. ${line}\n` }]);
  });

  content.push([
    { tag: "text", text: "\n" },
    { tag: "a", text: "查看产品君原视频", href: digest.link },
    {
      tag: "text",
      text: "\n\n说明：周报优先整理产品君公开发布的一周 AI 大事清单；如果当周视频暂未发布或来源不可用，会自动回退到公开 RSS 汇总。",
    },
  ]);

  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title: `本周AI大事看点：${digest.title.replace(/^盘点一周AI大事(?:\([^)]*\))?[｜|]?/i, "") || "产品君本周清单"}`,
          content,
        },
      },
    },
  };
}

function pickDistinctItems(candidates, limit) {
  const seenTitles = new Set();
  const seenFingerprints = new Set();
  const picked = [];

  const addItem = (item, target = picked) => {
    const titleKey = cleanNewsTitle(item.title).toLowerCase().replace(/\W+/g, " ").slice(0, 80);
    if (seenTitles.has(titleKey)) return false;

    const fingerprint = contentFingerprint(item);
    if (seenFingerprints.has(fingerprint)) return false;
    if (target.some((pickedItem) => sameNewsEvent(item, pickedItem))) return false;

    seenTitles.add(titleKey);
    seenFingerprints.add(fingerprint);
    target.push(item);
    return true;
  };

  for (const item of candidates) {
    addItem(item);
    if (picked.length >= limit) break;
  }

  return { picked, addItem };
}

function pickWeeklyItems(items) {
  const candidates = items
    .filter((item) => item.title && item.link)
    .filter(isAiNewsItem)
    .filter((item) => scoreItem(item) >= MIN_SIGNAL_SCORE)
    .sort((a, b) => {
      const progressDiff = technicalProgressRank(b) - technicalProgressRank(a);
      if (progressDiff !== 0) return progressDiff;
      return scoreItem(b) - scoreItem(a);
    });

  return pickDistinctItems(candidates, WEEKLY_DIGEST_LIMIT).picked;
}

function pickScopedItems(items, scope) {
  const limit = scope === "domestic" ? DOMESTIC_DIGEST_LIMIT : GLOBAL_DIGEST_LIMIT;
  const candidates = items
    .filter((item) => item.title && item.link)
    .filter(isAiNewsItem)
    .filter((item) => (scope === "domestic" ? isTechnicalProgressItem(item) : true))
    .filter((item) => scoreItem(item) >= MIN_SIGNAL_SCORE)
    .filter((item) => (scope === "domestic" ? isDomesticItem(item) : !isDomesticItem(item)))
    .sort((a, b) => {
      if (scope === "domestic") {
        const progressDiff = technicalProgressRank(b) - technicalProgressRank(a);
        if (progressDiff !== 0) return progressDiff;
      }
      return scoreItem(b) - scoreItem(a);
    });

  return pickDistinctItems(candidates, limit).picked;
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildPost(items, scope = "all") {
  const digestName = buildDigestName(scope);
  const content = [
    [
      {
        tag: "text",
        text: `${digestName}｜${todayInShanghai()}\n${buildTopLine(items, scope)}\n${buildOverview(items)}\n\n详细内容\n`,
      },
    ],
  ];

  items.forEach((item, index) => {
    const topic = classifyItem(item);
    content.push([
      {
        tag: "text",
        text: `#${index + 1} ${displayTitle(item)}\n来源：${sourceLabel(item)}｜${topic.name}\n`,
      },
      { tag: "a", text: "原始链接", href: item.link },
      { tag: "text", text: "\n\n" },
    ]);
  });

  content.push([
    {
      tag: "text",
      text: "说明：按公开来源自动整理，优先保留原始链接；低信号和重复事件会被过滤。",
    },
  ]);

  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title: items.length ? `${digestName}：${compactTitle(items[0], 20)}` : `${digestName}：暂无高信号新闻`,
          content,
        },
      },
    },
  };
}

function buildFeedFailurePost(errors) {
  const details = errors
    .slice(0, 4)
    .map(({ source, url, error }, index) => `${index + 1}. ${source}: ${error}\n${url}`)
    .join("\n\n");

  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title: "AI早报：新闻源抓取失败",
          content: [
            [
              {
                tag: "text",
                text: `AI早报｜${todayInShanghai()}\n今天没有成功抓取到可用 RSS 新闻源，所以没有生成正常早报。\n\n这条消息说明自动化任务已按时运行，但新闻源网络或服务端访问失败。\n\n失败摘要\n${details || "未返回具体错误。"}\n`,
              },
            ],
          ],
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFeed(feed) {
  const signal = AbortSignal.timeout(FEED_TIMEOUT_MS);
  const response = await fetch(feed.url, {
    signal,
    headers: { "user-agent": "ai-news-feishu-digest/2.0" },
  });

  if (!response.ok) throw new Error(`Feed failed ${response.status}`);
  const text = await response.text();
  if (!/<(?:rss|feed)\b/i.test(text) || !/<(?:item|entry)\b/i.test(text)) {
    const title = stripHtml(firstMatch(text, /<title[^>]*>([\s\S]*?)<\/title>/));
    throw new Error(`Feed returned non-RSS content${title ? ` (${title})` : ""}`);
  }
  return { feed, text };
}

async function sendProductJunWeeklyDigest() {
  const { text } = await fetchFeed(PRODUCTJUN_WEEKLY_FEED);
  const digest = parseProductJunWeeklyDigest(text);
  if (!digest) throw new Error("No current-week 产品君 digest found");
  const bvid = digest.link.match(/\/video\/(BV[\w]+)/i)?.[1];
  if (bvid) {
    const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: "https://www.bilibili.com/",
      },
    });
    if (response.ok) {
      const detail = await response.json();
      const lines = productJunDescriptionLines(detail.data?.desc);
      if (detail.code === 0 && lines.length) {
        digest.title = detail.data.title || digest.title;
        digest.lines = lines;
      }
    }
  }
  console.warn(`Weekly digest source: 产品君 Bilibili: ${digest.title}`);
  await sendToFeishu(buildProductJunWeeklyPost(digest));
}

async function main() {
  if (process.env.AI_NEWS_TEST === "1") {
    await sendToFeishu(buildPost([
      {
        title: "OpenAI releases a new model for coding agents - Example News",
        description: "This is a test item generated by the same script that sends the daily global digest.",
        link: "https://openai.com/",
        sourceName: "OpenAI",
      },
    ], "global"));
    await wait(800);
    await sendToFeishu(buildPost([
      {
        title: "通义千问开源多模态模型",
        description: "阿里通义千问发布开源多模态模型，支持图像理解和工具调用。",
        link: "https://github.com/features/actions",
        sourceName: "机器之心",
      },
    ], "domestic"));
    return;
  }

  if (DIGEST_MODE === "weekly") {
    try {
      await sendProductJunWeeklyDigest();
      return;
    } catch (error) {
      console.warn(`产品君 weekly digest unavailable, falling back to RSS summary: ${error.message}`);
    }
  }

  const settled = await Promise.allSettled(activeFeeds.map((feed) => fetchFeed(feed)));
  const successes = settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const responses = successes.map(({ text }) => text);
  const errors = settled
    .map((result, index) => ({ result, feed: activeFeeds[index] }))
    .filter(({ result }) => result.status === "rejected")
    .map(({ result, feed }) => ({
      source: feed.name,
      url: feed.url,
      error: result.reason?.message || String(result.reason),
    }));

  if (!responses.length) {
    await sendToFeishu(buildFeedFailurePost(errors));
    return;
  }

  if (successes.length) {
    console.warn(`Feeds ok: ${successes.map(({ feed }) => feed.name).join(", ")}`);
  }

  for (const { source, error, url } of errors) {
    console.warn(`Feed skipped: ${source}: ${error}: ${url}`);
  }

  const allItems = successes.flatMap(({ feed, text }) =>
    feed.name === "橘鸦 AI 早报 RSS" ? parseJuyaDigestFeed(text) : parseFeed(text),
  );
  if (DIGEST_MODE === "weekly") {
    await sendToFeishu(buildWeeklyPost(pickWeeklyItems(allItems)));
    return;
  }

  const globalItems = pickScopedItems(allItems, "global");
  const domesticItems = pickScopedItems(allItems, "domestic");

  if (DIGEST_SCOPE === "global") {
    await sendToFeishu(buildPost(globalItems, "global"));
    return;
  }
  if (DIGEST_SCOPE === "domestic") {
    await sendToFeishu(buildPost(domesticItems, "domestic"));
    return;
  }

  const scopedItems = [...globalItems, ...domesticItems];
  const juyaItems = scopedItems.filter((item) => item.sourceName.startsWith("橘鸦 AI 早报｜"));
  const supplementalItems = scopedItems
    .filter((item) => !item.sourceName.startsWith("橘鸦 AI 早报｜"))
    .sort((a, b) => scoreItem(b) - scoreItem(a));
  const combinedItems = pickDistinctItems([...juyaItems, ...supplementalItems], DAILY_DIGEST_LIMIT).picked;
  await sendToFeishu(buildPost(combinedItems));
}

await main();
