import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38,
  41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];

function getMixinKey(orig) {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n]).join('').slice(0, 32);
}

/**
 * 自动寻找本地已保存的 B站 Cookie 凭据
 */
export function loadCredentials() {
  const possiblePaths = [
    path.join(os.homedir(), '.dsh', 'bili-watch', 'credential.json'),
    path.join(os.homedir(), '.config', 'bili-watch', 'credential.json'),
    path.join(process.cwd(), 'credential.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        const parts = [];
        if (raw.buvid3) parts.push(`buvid3=${raw.buvid3}`);
        if (raw.buvid4) parts.push(`buvid4=${raw.buvid4}`);
        if (raw.sessdata) parts.push(`SESSDATA=${raw.sessdata}`);
        if (raw.bili_jct) parts.push(`bili_jct=${raw.bili_jct}`);
        if (raw.mid) parts.push(`DedeUserID=${raw.mid}`);
        return { cookieStr: parts.join('; '), mid: raw.mid, path: p };
      } catch (e) {
        // ignore parse error
      }
    }
  }
  return { cookieStr: '', mid: null, path: null };
}

/**
 * 获取请求头
 */
export function getHeaders(referer = 'https://www.bilibili.com/') {
  const cred = loadCredentials();
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': referer,
    'Accept': 'application/json, text/plain, */*'
  };
  if (cred.cookieStr) {
    headers['Cookie'] = cred.cookieStr;
  }
  return headers;
}

/**
 * 获取 Wbi 签名密钥
 */
export async function getWbiKeys() {
  const headers = getHeaders('https://www.bilibili.com/');
  const res = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers });
  const json = await res.json();
  const imgUrl = json?.data?.wbi_img?.img_url || '';
  const subUrl = json?.data?.wbi_img?.sub_url || '';
  const imgKey = imgUrl.split('/').pop().split('.')[0];
  const subKey = subUrl.split('/').pop().split('.')[0];
  return { imgKey, subKey, isLogin: Boolean(json?.data?.isLogin) };
}

/**
 * Wbi 签名计算
 */
export function signWbi(params, imgKey, subKey) {
  const mixinKey = getMixinKey(imgKey + subKey);
  const p = { ...params, wts: Math.round(Date.now() / 1000) };
  const query = Object.keys(p)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(p[k]).replace(/[!'()*]/g, ''))}`)
    .join('&');
  const w_rid = createHash('md5').update(query + mixinKey).digest('hex');
  return `${query}&w_rid=${w_rid}`;
}

/**
 * 解析用户输入的入参，支持：纯 UID、空间链接 (space.bilibili.com/946974)、或视频链接提取 UP
 */
export async function resolveMid(input) {
  const str = String(input).trim();
  // 纯数字 UID
  if (/^\d+$/.test(str)) {
    return str;
  }

  // 空间 URL: https://space.bilibili.com/946974
  const spaceMatch = str.match(/space\.bilibili\.com\/(\d+)/i);
  if (spaceMatch) {
    return spaceMatch[1];
  }

  // 视频 URL 或 BV 号提取 UP
  const bvMatch = str.match(/BV[a-zA-Z0-9]+/i);
  if (bvMatch) {
    const bvid = bvMatch[0];
    const headers = getHeaders();
    const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, { headers });
    const json = await res.json();
    if (json.code === 0 && json.data?.owner?.mid) {
      return String(json.data.owner.mid);
    }
  }

  throw new Error(`无法从输入 "${input}" 中解析出 B站 UP主 UID（支持传 UID、空间链接或视频链接）`);
}

/**
 * 获取 UP 主的基础资料（昵称、头像、粉丝量、签名等）
 */
export async function getUpMasterInfo(mid) {
  const headers = getHeaders(`https://space.bilibili.com/${mid}`);
  try {
    const res = await fetch(`https://api.bilibili.com/x/web-interface/card?mid=${mid}`, { headers });
    const json = await res.json();
    if (json.code === 0 && json.data?.card) {
      const card = json.data.card;
      return {
        mid,
        name: card.name || `UP主_${mid}`,
        sex: card.sex,
        face: card.face,
        sign: card.sign,
        level: card.level_info?.current_level || 0,
        fans: json.data.follower || 0
      };
    }
  } catch (e) {
    // fallback
  }

  return {
    mid,
    name: `UP主_${mid}`,
    sign: '',
    level: 0,
    fans: 0
  };
}

/**
 * 分页拉取 UP 主空间视频
 * @param {Object} options
 * @param {string} options.mid UP主UID
 * @param {string} options.order 排序方式：click (播放量最高/最热), pubdate (最新发布), stow (最多收藏)
 * @param {number} options.limit 抓取上限数量（默认 10）
 * @param {string} options.keyword 空间内搜索词（可选）
 */
export async function fetchUpVideos({ mid, order = 'click', limit = 10, keyword = '' }) {
  const { imgKey, subKey } = await getWbiKeys();
  const headers = getHeaders(`https://space.bilibili.com/${mid}/video`);

  const results = [];
  let page = 1;
  const pageSize = Math.min(limit, 30);
  let totalCount = 0;

  while (results.length < limit) {
    const params = {
      mid,
      ps: pageSize,
      pn: page,
      order: order === 'hot' ? 'click' : order === 'new' ? 'pubdate' : order,
      keyword: keyword || '',
    };

    const signedQuery = signWbi(params, imgKey, subKey);
    const searchUrl = `https://api.bilibili.com/x/space/wbi/arc/search?${signedQuery}`;
    const res = await fetch(searchUrl, { headers });
    const json = await res.json();

    if (json.code !== 0) {
      throw new Error(`B站空间接口返回错误 code=${json.code}: ${json.message}`);
    }

    const data = json.data;
    totalCount = data?.page?.count || 0;
    const vlist = data?.list?.vlist || [];
    if (!vlist.length) break;

    for (const v of vlist) {
      results.push({
        bvid: v.bvid,
        aid: v.aid,
        title: v.title,
        description: v.description,
        pic: v.pic,
        play: v.play,
        review: v.video_review, // 弹幕数
        favorites: v.favorites,
        length: v.length,
        created: v.created,
        date: new Date(v.created * 1000).toISOString().split('T')[0],
        url: `https://www.bilibili.com/video/${v.bvid}`
      });
      if (results.length >= limit) break;
    }

    if (results.length >= totalCount || vlist.length < pageSize) {
      break;
    }
    page++;
    // 礼貌限流休眠 800ms
    await new Promise((r) => setTimeout(r, 800));
  }

  return {
    mid,
    totalCount,
    videos: results
  };
}
