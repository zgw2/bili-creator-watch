# Bilibili Creator Watch (B站博主视频批量抓取与爆款深度拆解插件)

> 拓展 AI 智能体对长视频平台的感知能力。从“单视频总结”升级到“**整号博主内容矩阵与爆款密码分析**”。  
> 支持开箱接入 **DeepSeek Harness (DSH)**、**OpenAI Codex**、**Claude Code** 以及终端 CLI。

---

## ✨ 核心特性

- 🎯 **一键识别博主**：支持输入 **纯 UID**、**个人空间链接**（`space.bilibili.com/946974`）或**任意一支代表作视频**（自动溯源 UP 主）。
- ⚡️ **全自动 Wbi 混淆加签**：内置 B站最新 Wbi 接口签名与混淆密钥换算，免除外部复杂配置。
- 📊 **灵活的排序与筛选**：支持按 `hot` (播放量最高/爆款)、`new` (最新发布)、`stow` (最多收藏) 排序，支持空间内关键词过滤。
- 🛡️ **优雅限流与凭证共享**：智能复用本地已有的 B站 Cookie 凭证（避免未登录风控），内置请求随机抖动延迟。
- 🤖 **Agent / LLM 友好**：支持 `--format markdown` 与 `--format json`，可无缝交由 AI 进行结构化选题分析与创作 SOP 沉淀。

---

## 📦 安装与快速开始

### 1. 终端直接运行 (CLI 方式)

```bash
# 查看帮助
node bin/bili-creator.mjs --help

# 抓取 UP 主播放量 Top 5 视频（以影视飓风 UID: 946974 为例）
node bin/bili-creator.mjs 946974 --limit 5 --order hot

# 抓取并输出为 AI 友好的 Markdown 格式
node bin/bili-creator.mjs https://space.bilibili.com/946974 --format markdown
```

### 2. 在 DeepSeek Harness (DSH) 中挂载为 Skill

创建软链接至你的 skills 目录即可即刻生效：
```bash
ln -s "$(pwd)/skills/bili-creator-watch" ~/.dsh/skills/bili-creator-watch
```
挂载后，直接对 AI 说：
> *“帮我分析一下这个 UP 主的内容矩阵与爆款选题套路：https://space.bilibili.com/946974”*

### 3. 一键批量生成拆解素材

运行批量分析采集器：
```bash
node bin/bili-batch-analyze.mjs 946974 --limit 5 --output report-raw.md
```

---

## 🛠️ 目录架构

```text
bili-creator-watch/
├── README.md                           # 说明文档
├── package.json                        # 模块配置
├── bin/
│   ├── bili-creator.mjs                # 核心 CLI 入口（抓取列表、多格式输出）
│   └── bili-batch-analyze.mjs          # 批量分析素材构建工具
├── lib/
│   └── bili-space.mjs                  # Wbi 签名、UID 智能解析、空间 API 请求层
└── skills/
    └── bili-creator-watch/
        └── SKILL.md                    # DSH & Agent 智能体标准 Skill 规范
```

---

## 📄 开源许可
MIT License. 欢迎提交 Issue 与 PR 扩充抖音、小红书多平台支持！
