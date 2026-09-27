import { createRequire } from 'module';
const require = createRequire(process.env.PW_FROM || (process.cwd() + '/'));
const { chromium } = require('playwright-core');
// 使い方: PW_FROM=<playwright-core が入っているフォルダ/> node tools/og.mjs images/abl-tmp
//        （ローカル確認サーバー http://localhost:8983 を起動しておく。PNGが出るのでJPGに変換して images/abl/ へ）
const out = process.argv[2];
const cards = [
  ['og-home', 'AquaBit LAB — 海とAI、二つの未来へ。', 'AIを、|*現場の道具*に。', '個人・中小企業のAI導入サポート／相談から定着まで', '/images/abl/hero-poster.webp'],
  ['og-ai', 'AI導入サポート', 'AIの導入は、|使えるところから、*いっしょに*。', '相談する・いっしょに作る・自分たちで回す', '/images/abl/hero-poster.webp'],
  ['og-works', 'WORKS — 実績・取り組み', '作って、公開して、|*使っている*。', 'iOSアプリ2本・解説まんが22話・PV・Web・音楽', '/images/abl/work-bluelogbook.webp'],
  ['og-salon', 'AI学習サロン — 月額9,800円', 'AIを“使う”から、|*“創る”*へ。', '画像・音楽・Vibe Codingまで。Discordで質問できる', '/images/abl/hero-poster.webp'],
  ['og-marine', 'MARINE — 三浦 海の学校', '泳げなくても、|*ひとりでも*。', '神奈川・城ヶ島と宮川湾のダイビングスクール', '/images/abl/photo-fun.webp'],
  ['og-about', 'ABOUT — AquaBit LAB', '「自分には無理」を、|*「できた」*に変える。', '代表 吉田哲司（TJ）／PADIコースディレクター', '/images/abl/photo-surface.webp'],
];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const [name, k, t, s, img] of cards) {
  const u = new URL('http://localhost:8983/_dev/og');
  u.searchParams.set('k', k); u.searchParams.set('t', t); u.searchParams.set('s', s); u.searchParams.set('img', img);
  await page.goto(u.toString(), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}.png`, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log(name);
}
await browser.close();
