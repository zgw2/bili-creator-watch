#!/usr/bin/env node
import { resolveMid, getUpMasterInfo, fetchUpVideos, loadCredentials } from '../lib/bili-space.mjs';

function printHelp() {
  console.log(`
bili-creator-watch —— B站博主空间视频抓取与分析工具

用法:
  bili-creator <UID或主页链接> [选项]

选项:
  --limit <数字>     获取视频数量 (默认 10，最大 50)
  --order <排序>     排序方式: hot/click(最热/播放最高), new/pubdate(最新发布), stow(最多收藏) (默认 hot)
  --keyword <关键词>  博主空间内搜索指定关键词视频
  --format <格式>    输出格式: pretty (默认彩色列表), json (JSON原始数据), markdown (可直接交由AI分析的Markdown表格)
  --help             显示帮助信息

示例:
  bili-creator 946974 --limit 5 --order hot
  bili-creator https://space.bilibili.com/946974 --format markdown
  bili-creator BV1Uh411p7r3 --limit 10
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let target = '';
  let limit = 10;
  let order = 'click';
  let keyword = '';
  let format = 'pretty';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) {
      limit = parseInt(args[++i], 10) || 10;
    } else if (arg === '--order' && args[i + 1]) {
      order = args[++i];
    } else if (arg === '--keyword' && args[i + 1]) {
      keyword = args[++i];
    } else if (arg === '--format' && args[i + 1]) {
      format = args[++i];
    } else if (!arg.startsWith('-') && !target) {
      target = arg;
    }
  }

  if (!target) {
    console.error('错误: 请提供 UP主 UID、空间链接或视频链接！');
    process.exit(1);
  }

  try {
    const cred = loadCredentials();
    const mid = await resolveMid(target);
    const [info, listData] = await Promise.all([
      getUpMasterInfo(mid),
      fetchUpVideos({ mid, order, limit, keyword })
    ]);

    if (format === 'json') {
      console.log(JSON.stringify({ author: info, ...listData }, null, 2));
      return;
    }

    if (format === 'markdown') {
      console.log(`# UP主: ${info.name} (UID: ${mid})`);
      console.log(`- **空间总投稿**: ${listData.totalCount} 支视频`);
      console.log(`- **个性签名**: ${info.sign || '（无）'}`);
      console.log(`- **本次拉取**: ${listData.videos.length} 支 (排序: ${order})\n`);
      console.log(`| 序号 | BV号 | 视频标题 | 播放量 | 弹幕数 | 时长 | 发布日期 | 链接 |`);
      console.log(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);
      listData.videos.forEach((v, idx) => {
        console.log(`| ${idx + 1} | \`${v.bvid}\` | ${v.title.replace(/\|/g, '/')} | ${v.play.toLocaleString()} | ${v.review.toLocaleString()} | ${v.length} | ${v.date} | [观看](${v.url}) |`);
      });
      return;
    }

    // Default: pretty output
    console.log(`\n========================================================`);
    console.log(`🎥 UP主: \x1b[36m${info.name}\x1b[0m (UID: ${mid})`);
    console.log(`📝 签名: ${info.sign || '（无）'}`);
    console.log(`📊 空间总投稿: \x1b[33m${listData.totalCount}\x1b[0m 支视频 | 本次展示 Top \x1b[32m${listData.videos.length}\x1b[0m (排序: ${order})`);
    if (cred.path) {
      console.log(`🔑 运行凭据: \x1b[90m已加载本地 Cookie (${cred.path})\x1b[0m`);
    }
    console.log(`========================================================\n`);

    listData.videos.forEach((v, idx) => {
      console.log(`[${idx + 1}] \x1b[1m${v.title}\x1b[0m`);
      console.log(`    BV: \x1b[34m${v.bvid}\x1b[0m | 播放: \x1b[33m${v.play.toLocaleString()}\x1b[0m | 弹幕: ${v.review.toLocaleString()} | 时长: ${v.length} | 发布: ${v.date}`);
      console.log(`    链接: ${v.url}\n`);
    });

  } catch (err) {
    console.error(`\x1b[31m执行失败: ${err.message}\x1b[0m`);
    process.exit(1);
  }
}

main();
