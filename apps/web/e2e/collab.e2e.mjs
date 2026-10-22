// 端到端：分享链接 → 家人（访客、可评论）打开 → 在对象上评论 → agent 回复并标“待业主确认” → 版本回退 → 手机布局
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) process.exitCode = 1;
};
const apiOn = page => (path, init) =>
  page.evaluate(async ([p, i]) => {
    const r = await fetch(`/api${p}`, { ...i, headers: { 'Content-Type': 'application/json' } });
    return { status: r.status, body: await r.json() };
  }, [path, init]);

// 主人
const owner = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
await owner.goto(BASE, { waitUntil: 'networkidle' });
await owner.getByRole('button', { name: /打开样例方案/ }).click();
await owner.waitForURL(/\/p\//);
const projectId = owner.url().match(/\/p\/([^/?]+)/)[1];
await owner.waitForFunction(() => window.artifact?.ready);
const oapi = apiOn(owner);
const link = await oapi(`/projects/${projectId}/links`, { method: 'POST', body: JSON.stringify({ role: 'commenter' }) });
check(link.status === 200, '生成可评论的分享链接');

// 家人：手机打开链接
const fam = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await fam.goto(`${BASE}/s/${link.body.token}`, { waitUntil: 'networkidle' });
check(await fam.getByText('你的权限：可评论').isVisible(), '分享页显示权限');
await fam.getByRole('button', { name: '打开方案' }).click();
await fam.waitForURL(/\/p\//);
await fam.waitForFunction(() => window.artifact?.ready);
await fam.waitForTimeout(1000);
await fam.screenshot({ path: `${OUT}/mobile-1.png` });
const edit = await fam.evaluate(() => window.artifact.call('wall_move', { wall: '一层·老人房一西墙', direction: 'west', distance: 100 }));
check(edit.ok === false && edit.error.code === 'forbidden', '可评论的人不能改方案');
const fapi = apiOn(fam);
const put = await fapi(`/projects/${projectId}`, { method: 'PUT', body: JSON.stringify({ base: 1, content: {} }) });
check(put.status === 403, `服务端也拒绝保存：${put.status}`);

// 在对象上评论：选中厨房，打开评论面板
const kitchen = await fam.evaluate(() => window.artifact.project().spaces.find(s => s.name === '厨房').id);
await fam.evaluate(id => window.artifact.call('view_focus', { ids: [id] }), kitchen);
await fam.getByRole('button', { name: '评论' }).click();
await fam.getByPlaceholder('写评论…').fill('厨房窗户能不能再高一点？');
await fam.getByRole('button', { name: '发表' }).click();
const tagged = await fam.getByText('@厨房').first().waitFor({ timeout: 10000 }).then(() => true, () => false);
check(tagged, '评论挂在“厨房”上');
await fam.screenshot({ path: `${OUT}/mobile-2-comment.png` });

// 主人：agent 处理评论（直接调能力，验证评论工具链）
const list = await owner.evaluate(() => window.artifact.call('comments_list', {}));
check(list.ok && list.result.length === 1 && list.result[0].target_name === '厨房', '主人看到评论');
const reply = await owner.evaluate(id => window.artifact.call('comment_reply', { comment: id, body: '可以把窗台从 1.2 米降到 0.9 米，或者窗加高 0.3 米，您选哪个？', status: 'pending-confirm' }), list.result[0].id);
check(reply.ok, 'agent 回复评论');
const after = await oapi(`/projects/${projectId}/comments`);
check(after.body.find(c => !c.parent_id).status === 'pending-confirm', '评论标成“待业主确认”');

// 版本：改一下，再回退
await owner.evaluate(() => window.artifact.call('space_set_area', { space: '一层·老人房一', area: 13 }));
await owner.waitForFunction(() => document.body.innerText.includes('第 2 版'), null, { timeout: 15000 });
const vers = await oapi(`/projects/${projectId}/versions`);
check(vers.body.length === 2, `有 ${vers.body.length} 个版本`);
await owner.getByRole('tab', { name: '版本' }).click();
await owner.getByText('第 1 版', { exact: false }).first().click();
await owner.getByText('正在查看第 1 版').waitFor();
await owner.getByRole('button', { name: '回退到这一版' }).click();
await owner.waitForFunction(() => document.body.innerText.includes('第 3 版'), null, { timeout: 15000 });
const area = await owner.evaluate(() => window.artifact.call('get_object', { ref: '一层·老人房一' }));
check(Math.abs(area.result.netArea - 12) < 0.05, `回退后老人房一回到 ${area.result.netArea} m²（存为第 3 版）`);
await owner.screenshot({ path: `${OUT}/versions.png` });

// 方案列表缩略图
await owner.waitForTimeout(3500);
const projects = await oapi('/projects');
check(!!projects.body[0].thumbnail?.startsWith('<svg'), '保存后生成了缩略图');
await b.close();
