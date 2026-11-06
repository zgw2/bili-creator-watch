#!/usr/bin/env node
import { resolveMid, getUpMasterInfo, fetchUpVideos } from '../lib/bili-space.mjs';

function printHelp() {
  console.log(`
bili-creator-batch-summary —— 批量提取博主视频摘要与分析准备

用法:
  bili-batch-analyze <UID/主页链接> [选项]

选项:
  --limit <数量>    分析视频数量 (默认 5，建议 3~10，避免模型上下文过载)
  --order <排序>    排序方式: click(播放最高/爆款), pubdate(最新发布) (默认 click)
  --output <文件>   将提取的博主所有视频摘要保存到 Markdown 文件
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let target = '';
  let limit = 5;
  let order = 'click';
  let outFile = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) limit = parseInt(args[++i], 10) || 5;
    else if (arg === '--order' && args[i + 1]) order = args[++i];
    else if (arg === '--output' && args[i + 1]) outFile = args[++i];
    else if (!arg.startsWith('-') && !target) target = arg;
  }

  const mid = await resolveMid(target);
  const info = await getUpMasterInfo(mid);
  const listData = await fetchUpVideos({ mid, order, limit });

  console.log(`\n正在抓取 UP主 [${info.name}] 的 ${listData.videos.length} 支视频元数据与分析材料...\n`);

  const report = [];
  report.push(`# UP主内容矩阵拆解报告素材：${info.name} (UID: ${mid})`);
  report.push(`- **粉丝量**: ${info.fans ? info.fans.toLocaleString() : '未知'}`);
  report.push(`- **空间总投稿**: ${listData.totalCount} 支`);
  report.push(`- **分析样本**: ${listData.videos.length} 支（排序依据: ${order === 'click' ? '历史播放量 Top' : '最新发布'}）\n`);
  report.push(`---`);

  for (let i = 0; i < listData.videos.length; i++) {
    const v = listData.videos[i];
    console.log(`[${i + 1}/${listData.videos.length}] 处理视频: ${v.title} (${v.bvid})...`);

    report.push(`\n## 视频样本 ${i + 1}：${v.title}`);
    report.push(`- **BV号**: \`${v.bvid}\` | **播放量**: ${v.play.toLocaleString()} | **弹幕**: ${v.review.toLocaleString()} | **时长**: ${v.length}`);
    report.push(`- **视频简介**: ${v.description || '（无简介）'}`);
    report.push(`- **直达链接**: ${v.url}`);
  }

  report.push(`\n---\n## AI 拆解任务指引 (Agent Instructions)`);
  report.push(`请作为首席内容分析师，基于以上视频样本执行深度内容拆解：`);
  report.push(`1. **爆款选题与标题套路**：分析该 UP 主播放量最高的视频具有什么选题共性？标题采用了哪些心理学钩子？`);
  report.push(`2. **黄金前 3 秒与叙事节奏**：分析其视频引入问题的方式。`);
  report.push(`3. **商业化与用户互动**：分析其弹幕高潮分布与价值沉淀机制。`);
  report.push(`4. **可复用的创作 SOP**：为同领域创作者提炼一套可以直接套用的 4 步创作流程。`);

  const fullContent = report.join('\n');

  if (outFile) {
    import('node:fs').then(({ writeFileSync }) => {
      writeFileSync(outFile, fullContent, 'utf8');
      console.log(`\n✅ 拆解素材已成功写入: ${outFile}`);
    });
  } else {
    console.log('\n' + fullContent);
  }
}

main().catch(console.error);
