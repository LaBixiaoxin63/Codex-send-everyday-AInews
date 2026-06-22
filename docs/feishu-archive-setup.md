# 飞书日报归档配置

本文档说明如何让 AI 日报/周报在发送飞书群消息之外，自动写入飞书多维表格和可选飞书文档。

## 当前运行方式

自动任务仍然由 GitHub Actions 云端运行，不依赖本地电脑或 Codex 在线。

```text
GitHub Actions
  -> scripts/send-ai-news-feishu.mjs
  -> 抓取橘鸦日报 / 产品君周报
  -> 可选写入飞书多维表格
  -> 可选创建飞书文档
  -> 发送飞书群消息
```

未配置归档相关 Secret 时，脚本会保持原行为：只发送飞书群消息。

## 推荐先做多维表格

多维表格最稳定，适合长期检索和统计。

建议字段全部先建成文本字段：

```text
日期
类型
序号
标题
分类
来源
原文链接
发布标题
原始发布
归档时间
```

脚本会把每条日报/周报条目写成一行。

## GitHub Secrets

在仓库的 GitHub Actions Secrets 中添加以下变量。

必需：

```text
FEISHU_WEBHOOK_URL
```

启用飞书开放平台归档时需要：

```text
FEISHU_APP_ID
FEISHU_APP_SECRET
```

启用多维表格归档时需要：

```text
FEISHU_BITABLE_APP_TOKEN
FEISHU_BITABLE_TABLE_ID
```

启用飞书文档创建时需要：

```text
FEISHU_DOC_FOLDER_TOKEN
```

## 飞书开放平台权限

需要在飞书开放平台 App 中开通相应权限，并发布/生效。

多维表格通常需要：

```text
bitable:app
bitable:app:readonly
```

云文档创建通常需要文档创建、编辑、文件夹写入相关权限。不同租户后台展示名称可能略有差异，以开放平台控制台为准。

## 重要说明

- 归档失败不会阻断飞书群消息发送。
- 飞书群消息底部会显示归档结果，例如 `多维表格已写入 8 条`。
- 文档创建接口比多维表格更容易受权限和 API 结构影响；建议先启用多维表格，确认稳定后再启用文档。
- 不要把 App Secret 或 Webhook URL 写入仓库文件。

