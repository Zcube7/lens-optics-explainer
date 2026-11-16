// 从 Poly Haven 下载取景器用的 CC0 素材原件（清单固定，共 30 个文件约 17 MB）。
// 用法：node tools/fetch_assets.mjs assets      下完再跑 tools/shrink_assets.py 生成预览版并缩小道具贴图
// 网络走 curl（本机 node 的 fetch 连不上 Cloudflare，curl 可以）。下载的文件只是数据，不执行。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
if (!OUT) throw new Error('缺少目标目录');
const UA = 'lens-optics-explainer (asset fetch)';
const curl = (args) => execFileSync('curl', ['-sS', '--ssl-no-revoke', '--retry', '3', '--retry-delay', '2', '-m', '300', '-A', UA, ...args], { maxBuffer: 64 * 1024 * 1024 });
const api = (id) => JSON.parse(curl(['https://api.polyhaven.com/files/' + id]).toString('utf8'));

const MODELS = [['marble_bust_01', '2k'], ['street_lamp_01', '1k'], ['Lantern_01', '1k'], ['potted_plant_02', '1k'], ['concrete_cat_statue', '1k']];
const list = [];
for (const [id, res] of MODELS) {
  const e = api(id).gltf[res].gltf;
  list.push({ dest: path.join('models', id, e.url.split('/').pop()), url: e.url, size: e.size });
  for (const [rel, v] of Object.entries(e.include || {})) list.push({ dest: path.join('models', id, rel), url: v.url, size: v.size });
}
const h = api('shanghai_bund');
list.push({ dest: path.join('env', 'shanghai_bund.jpg'), url: h.tonemapped.url, size: h.tonemapped.size });
list.push({ dest: path.join('env', 'shanghai_bund_1k.hdr'), url: h.hdri['1k'].hdr.url, size: h.hdri['1k'].hdr.size });

let total = 0, bad = 0;
for (const f of list) {
  // 只接受 Poly Haven 自己的文件域名，目标路径必须落在 OUT 里面
  if (!/^https:\/\/dl\.polyhaven\.org\//.test(f.url)) { console.log('SKIP 非预期域名 ' + f.url); bad++; continue; }
  const dest = path.resolve(OUT, f.dest);
  if (!dest.startsWith(path.resolve(OUT) + path.sep)) { console.log('SKIP 路径越界 ' + f.dest); bad++; continue; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!(fs.existsSync(dest) && fs.statSync(dest).size === f.size)) curl(['-o', dest, f.url]);
  const got = fs.statSync(dest).size; total += got;
  const ok = got === f.size; if (!ok) bad++;
  console.log((ok ? 'ok  ' : 'BAD ') + (got / 1048576).toFixed(2).padStart(6) + ' MB  ' + f.dest.replace(/\\/g, '/'));
}
console.log(`共 ${list.length} 个文件，${(total / 1048576).toFixed(2)} MB，异常 ${bad} 个`);
