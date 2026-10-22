// 完整走查并录屏：电脑上的业主 + 手机上的家人，每一步检查结果。
// 用法：BASE=http://localhost:3000 FAKE_LLM=http://127.0.0.1:8791/v1 DEV_LOG=<vite 日志> node e2e/walkthrough.mjs <输出目录>
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const FAKE = process.env.FAKE_LLM ?? 'http://127.0.0.1:8791/v1';
const OUT = process.argv[2] ?? '.';
const report = [];
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(3, ' ') + 's';
const check = (step, ok, msg) => {
  report.push({ step, ok, msg, at: stamp() });
  console.log(`${ok ? '✓' : '✗'} [${stamp()}] ${step}：${msg}`);
};

// UTF-8 环境：容器默认 locale 为空时，Chromium 会把中文下载文件名退化成 download
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'], slowMo: 60, env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
const ownerCtx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: `${OUT}/raw-owner`, size: { width: 1280, height: 800 } }, permissions: ['clipboard-read', 'clipboard-write'] });
const famCtx = await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, recordVideo: { dir: `${OUT}/raw-family`, size: { width: 390, height: 800 } } });
const owner = await ownerCtx.newPage();
const fam = await famCtx.newPage();
const errors = [];
for (const [who, p] of [['业主', owner], ['家人', fam]]) {
  p.on('pageerror', e => errors.push(`${who}: ${e.message}`));
  p.on('console', m => m.type() === 'error' && !/GPU stall/.test(m.text()) && errors.push(`${who}: ${m.text()}`));
}

/** 画面上方的步骤说明（只在录像里，不属于产品界面） */
async function caption(page, text) {
  await page.evaluate(t => {
    let el = document.getElementById('__walk');
    if (!el) {
      el = document.createElement('div');
      el.id = '__walk';
      el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;background:rgba(0,0,0,.82);color:#fff;font:500 15px/1.5 system-ui,sans-serif;padding:8px 14px;border-radius:8px;max-width:92%;text-align:center;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}
const pause = (ms = 1200) => new Promise(r => setTimeout(r, ms));
const ready = p => p.waitForFunction(() => window.artifact?.ready, null, { timeout: 30000 });
const say = async (text) => {
  const box = owner.getByPlaceholder('说说想怎么改…');
  await box.click();
  await box.pressSequentially(text, { delay: 60 });
  await pause(400);
  await box.press('Enter');
};
/** 点选平面图上的房间：点房间名 */
async function tapRoom(page, name) {
  const label = page.frameLocator('iframe[title="画布"]').locator('svg text', { hasText: new RegExp(`^${name}$`) }).first();
  const box = await label.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

await fam.goto(`${BASE}/`);
await caption(fam, '家人的手机：稍后会收到分享链接');

// ---------- 1. 介绍页 ----------
await owner.goto(BASE, { waitUntil: 'networkidle' });
await caption(owner, '① 介绍页：无需注册即可试用');
await pause(2500);
check('介绍页', await owner.getByRole('heading', { name: '说话就能改的房屋方案' }).isVisible(), '标题、样例平面图、两个入口');

// ---------- 2. 从零开始 ----------
await caption(owner, '② 点“从零开始”：以访客身份进入一个空白方案');
await pause(800);
await owner.getByRole('button', { name: '从零开始' }).click();
await owner.waitForURL(/\/p\//);
await ready(owner);
await pause(1500);
const blankId = owner.url().match(/\/p\/([^/?]+)/)[1];
check('从零开始', (await owner.evaluate(() => window.artifact.project().walls.length)) === 0, '进入空白方案，对话框提示“说说你想要什么样的房子”');

// ---------- 3. 配置大模型 ----------
await caption(owner, '③ 大模型由用户自带：设置里添加密钥（这里用演示用的脚本模型）');
await owner.goto(`${BASE}/settings`);
await owner.getByRole('heading', { name: '大模型' }).waitFor();
await pause(800);
await owner.getByRole('combobox').first().click();
await owner.getByRole('option', { name: 'OpenAI 兼容接口' }).click();
await owner.getByLabel('型号').fill('demo-model');
await owner.getByLabel('接口地址').fill(FAKE);
await owner.getByLabel('API Key').pressSequentially('sk-demo-0000-1234', { delay: 30 });
await owner.getByLabel('名称（可选）').fill('演示用脚本模型');
await pause(600);
await owner.getByRole('button', { name: '添加' }).click();
await owner.getByText('演示用脚本模型').first().waitFor();
await pause(1200);
const keyShown = await owner.getByText('sk-demo-0000-1234').count();
check('添加模型', keyShown === 0 && (await owner.getByText('…1234').count()) > 0, '密钥加密保存，列表只显示末 4 位');

await caption(owner, '④ 在方案的“分享”里选用这个模型');
await owner.goto(`${BASE}/p/${blankId}`);
await ready(owner);
await owner.getByRole('button', { name: '分享' }).click();
await owner.getByRole('dialog').getByRole('combobox').last().click();
await owner.getByRole('option', { name: /演示用脚本模型/ }).click();
await pause(1200);
await owner.keyboard.press('Escape');
check('选用模型', (await owner.getByText('模型：演示用脚本模型').count()) > 0, '对话面板显示当前模型');

// ---------- 4. 一句话起步 ----------
await caption(owner, '⑤ 一句话说需求，agent 记下需求、排出起始方案、自己检查');
await say('一家四口，一层，要两间卧室，卧室朝南');
await owner.getByText(/^好了。按你的需求/).waitFor({ timeout: 40000 });
await pause(2500);
const built = await owner.evaluate(() => window.artifact.project());
check('从零起步', built.spaces.length === 5 && built.brief.household?.length === 2, `搭出 ${built.spaces.length} 个房间、${built.walls.length} 面墙，记下需求“${built.brief.household?.join('、')}”`);
const rules = await owner.evaluate(() => window.artifact.call('check_rules', {}));
check('规则检查', rules.result.issues.every(i => i.severity !== 'error'), `无错误（警告 ${rules.result.issues.length} 条）`);
await caption(owner, '⑥ 切到三维白模；点一面墙，选中的东西会往上跳一下，不变色');
await owner.getByLabel('三维', { exact: true }).click();
await pause(3000);
const someWall = await owner.evaluate(() => window.artifact.project().walls[0].id);
await owner.evaluate(id => window.artifact.call('view_focus', { ids: [id], highlight: false }), someWall);
await pause(3500);
await owner.keyboard.press('Escape');
await owner.getByLabel('平面', { exact: true }).click();
await pause(800);

// ---------- 5. 样例方案 ----------
await caption(owner, '⑦ 打开一个已有方案：乌石合院（三层带院子）');
await owner.goto(`${BASE}/projects`);
await owner.getByRole('button', { name: '新建方案' }).first().click();
await owner.getByLabel('名称').fill('乌石合院');
await owner.getByRole('dialog').getByRole('combobox').first().click();
await owner.getByRole('option', { name: /样例：乌石合院/ }).click();
await pause(500);
await owner.getByRole('button', { name: '创建' }).click();
await owner.waitForURL(/\/p\//);
await ready(owner);
const sampleId = owner.url().match(/\/p\/([^/?]+)/)[1];
await owner.getByRole('button', { name: '分享' }).click();
await owner.getByRole('dialog').getByRole('combobox').last().click();
await owner.getByRole('option', { name: /演示用脚本模型/ }).click();
await owner.keyboard.press('Escape');
await pause(1200);

await caption(owner, '⑧ 在图上点选“老人房一”：它会跳一下；属性面板显示面积、四周的墙和相邻房间');
await tapRoom(owner, '老人房一');
await owner.getByRole('tab', { name: '属性' }).click();
await pause(2500);
check('点选', (await owner.getByText('四周').count()) > 0 && (await owner.getByText('12.0 m²').count()) > 0, '老人房一 12.0 m²，列出四周的墙');

// ---------- 6. 对话改方案 ----------
await owner.getByRole('tab', { name: '对话' }).click();
await caption(owner, '⑨ 说“扩到 12.5 平”：agent 移墙、自检，改到的东西从中心往外依次跳一下');
await say('老人房一扩到 12.5 平');
await owner.getByText(/^好了。老人房一现在/).waitFor({ timeout: 40000 });
await pause(2000);
const a1 = await owner.evaluate(() => window.artifact.call('get_object', { ref: '一层·老人房一' }));
check('agent 调面积', Math.abs(a1.result.netArea - 12.5) < 0.15, `老人房一 12.0 → ${a1.result.netArea} m²`);
await caption(owner, '⑩ 改动卡片：各房间面积变化；点“对比改前”，原来的墙用虚线画出');
await owner.getByRole('button', { name: '对比改前' }).click();
await pause(3000);
await caption(owner, '⑪ 不满意可以一键撤销，再重做');
await owner.getByRole('button', { name: '撤销' }).last().click();
await pause(1500);
const undone = await owner.evaluate(() => window.artifact.call('get_object', { ref: '一层·老人房一' }));
await owner.getByLabel('重做').click();
await pause(1500);
const redone = await owner.evaluate(() => window.artifact.call('get_object', { ref: '一层·老人房一' }));
check('撤销 / 重做', undone.result.netArea === 12 && Math.abs(redone.result.netArea - 12.5) < 0.15, `撤销后 ${undone.result.netArea}，重做后 ${redone.result.netArea} m²`);

// ---------- 网页深色，画布不变 ----------
await caption(owner, '⑪+ 网页跟随系统切到深色，画布始终是亮色');
await owner.emulateMedia({ colorScheme: 'dark' });
await pause(3000);
const canvasBg = await owner.frameLocator('iframe[title="画布"]').locator('svg').evaluate(el => getComputedStyle(el).backgroundColor);
const pageBg = await owner.evaluate(() => getComputedStyle(document.body).backgroundColor);
check('画布主题独立', canvasBg !== pageBg, `网页背景 ${pageBg}，画布背景 ${canvasBg}`);
await owner.emulateMedia({ colorScheme: 'light' });
await pause(1000);

// ---------- 7. 需要确认的操作 ----------
await caption(owner, '⑫ 不可逆的操作（删楼层）agent 会先问；点“不要”就不执行');
await say('删掉三层');
await owner.getByText('agent 想要：删楼层').waitFor({ timeout: 40000 });
await pause(2500);
await owner.getByRole('button', { name: '不要' }).click();
await owner.getByText('好的，三层保留不动。').waitFor({ timeout: 40000 });
await pause(1500);
const levels = await owner.evaluate(() => window.artifact.project().levels.map(l => l.name));
check('确认', levels.includes('三层'), `拒绝后楼层：${levels.join('、')}`);

// ---------- 8. 分享给家人 ----------
await caption(owner, '⑬ 分享：生成一个“可评论”的链接发给家人');
await owner.getByRole('button', { name: '分享' }).click();
await pause(1200);
await owner.getByRole('button', { name: '生成并复制链接' }).click();
await pause(1500);
const links = await owner.evaluate(async id => (await (await fetch(`/api/projects/${id}/sharing`)).json()).links, sampleId);
await pause(1200);
await owner.keyboard.press('Escape');
check('分享链接', links.length === 1 && links[0].role === 'commenter', `链接权限：可评论`);

await caption(fam, '⑭ 家人在手机上打开链接，不用注册');
await fam.goto(`${BASE}/s/${links[0].token}`);
await caption(fam, '⑭ 家人在手机上打开链接，不用注册');
await pause(1500);
await fam.getByRole('button', { name: '打开方案' }).click();
await fam.waitForURL(/\/p\//);
await ready(fam);
await caption(fam, '⑮ 手机上画布全屏，面板从底部弹出');
await pause(2000);
const famEdit = await fam.evaluate(() => window.artifact.call('wall_move', { wall: '一层·老人房一西墙', direction: 'west', distance: 100 }));
check('家人权限', famEdit.ok === false, '可评论的人不能改方案');
await caption(fam, '⑯ 点选厨房，在它上面留评论');
await tapRoom(fam, '厨房');
await pause(800);
await fam.getByRole('button', { name: '评论' }).click();
await pause(800);
await fam.getByPlaceholder('写评论…').click();
await fam.getByPlaceholder('写评论…').fill('厨房窗户能不能再高一点？');
await pause(800);
await fam.getByRole('button', { name: '发表' }).click();
await fam.getByText('@厨房').first().waitFor({ timeout: 10000 });
await pause(2000);
check('评论', true, '评论挂在“厨房”上');

await caption(owner, '⑰ 业主看到家人的评论，处理后标为已解决');
await owner.getByRole('tab', { name: '评论' }).click();
await owner.getByText('厨房窗户能不能再高一点？').waitFor({ timeout: 35000 }).catch(async () => {
  await owner.reload();
  await ready(owner);
  await owner.getByRole('tab', { name: '评论' }).click();
});
await pause(1500);
await owner.getByRole('button', { name: '解决' }).first().click();
await pause(1500);
check('处理评论', (await owner.getByText('已解决（1）').count()) > 0, '评论已解决');

// ---------- 9. 版本 ----------
await caption(owner, '⑱ 每次修改自动存版本：查看第 1 版，再回退');
await owner.getByRole('tab', { name: '版本' }).click();
await pause(1200);
await owner.getByText(/第 1 版/).first().click();
await owner.getByText('正在查看第 1 版（只读）').waitFor();
await pause(1500);
await owner.getByRole('button', { name: '回退到这一版' }).click();
await pause(2500);
const back = await owner.evaluate(() => window.artifact.call('get_object', { ref: '一层·老人房一' }));
check('版本回退', back.result.netArea === 12, `回退后老人房一 ${back.result.netArea} m²，存为新版本`);

// ---------- 10. 导出 ----------
await caption(owner, '⑲ 导出平面图图片');
await owner.getByLabel('更多').click();
const [dl] = await Promise.all([owner.waitForEvent('download'), owner.getByRole('menuitem', { name: '导出图片' }).click()]);
await pause(1000);
const png = readFileSync(await dl.path());
check('导出图片', /\.png$/.test(dl.suggestedFilename()) && png.subarray(1, 4).toString() === 'PNG', `${dl.suggestedFilename()}（${(png.length / 1024).toFixed(0)} KB）`);

// ---------- 11. 登录 ----------
await caption(owner, '⑳ 登录：输入邮箱收验证码；试用期间的方案自动转到正式账号');
await owner.goto(`${BASE}/projects`);
await pause(1200);
await owner.getByRole('button', { name: '登录保存' }).click();
await owner.getByLabel('邮箱').pressSequentially('owner@example.com', { delay: 40 });
await owner.getByRole('button', { name: '发送验证码' }).click();
await owner.locator('input#code').waitFor();
await pause(1200);
const otp = [...readFileSync(process.env.DEV_LOG, 'utf8').matchAll(/owner@example\.com 的验证码：(\d{6})/g)].at(-1)[1];
await owner.locator('input#code').pressSequentially(otp, { delay: 80 });
await owner.getByRole('button', { name: '登录' }).click();
await owner.waitForURL(/\/projects/);
await pause(2500);
const mine = await owner.evaluate(async () => (await (await fetch('/api/projects')).json()).map(p => p.name));
const me = await owner.evaluate(async () => (await (await fetch('/api/me')).json()).user);
check('登录', !me.isAnonymous && mine.includes('乌石合院') && mine.includes('我的新房子'), `登录为 ${me.email}，名下方案：${mine.join('、')}`);
await caption(owner, '走查完成');
await pause(2000);

check('页面报错', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : '全程无报错');
const ownerVideo = await owner.video().path();
const famVideo = await fam.video().path();
await ownerCtx.close();
await famCtx.close();
await b.close();
writeFileSync(`${OUT}/walkthrough-report.json`, JSON.stringify({ report, ownerVideo, famVideo }, null, 1));
console.log(JSON.stringify({ ownerVideo, famVideo }));
