// 端到端：访客试用 → 配置模型（假大模型）→ 对话改方案 → 需确认的操作弹确认 → 用量记录
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) process.exitCode = 1;
};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /打开样例方案/ }).click();
await page.waitForURL(/\/p\//);
const projectId = page.url().match(/\/p\/([^/?]+)/)[1];
await page.waitForFunction(() => window.artifact?.ready);

const api = (path, init) => page.evaluate(async ([p, i]) => {
  const r = await fetch(`/api${p}`, { ...i, headers: { 'Content-Type': 'application/json' } });
  return { status: r.status, body: await r.json() };
}, [path, init]);

const added = await api('/models', { method: 'POST', body: JSON.stringify({ provider: 'compatible', model: 'fake-model', apiKey: 'sk-test-12345678', label: '测试模型', baseUrl: process.env.FAKE_LLM ?? 'http://127.0.0.1:8787/v1' }) });
check(added.status === 200, `添加模型配置 ${added.status}`);
const models = await api('/models');
check(!JSON.stringify(models.body).includes('sk-test-12345678'), '模型列表不返回明文密钥');
check(models.body.configs[0].key_hint === '…5678', '只显示密钥末 4 位');
const pick = await api(`/projects/${projectId}/model`, { method: 'PUT', body: JSON.stringify({ modelConfigId: added.body.id }) });
check(pick.status === 200, '方案选用模型');
await page.reload();
await page.waitForFunction(() => window.artifact?.ready);

const before = await page.evaluate(() => window.artifact.call('get_object', { ref: '一层·老人房一' }));
const box = page.getByPlaceholder('说说想怎么改…');
await box.fill('老人房一扩到 12.5 平');
await box.press('Enter');
await page.getByText(/^好了。/).first().waitFor({ timeout: 30000 });
const after = await page.evaluate(() => window.artifact.call('get_object', { ref: '一层·老人房一' }));
check(Math.abs(after.result.netArea - 12.5) < 0.15, `agent 调面积：${before.result.netArea} → ${after.result.netArea} m²`);
check(await page.getByText('对比改前').isVisible(), '显示改动卡片（前后对比、撤销）');
await page.screenshot({ path: `${OUT}/agent-1.png` });

// 需要确认的操作：删楼层
await box.fill('删掉三层');
await box.press('Enter');
await page.getByText('agent 想要：删楼层').waitFor({ timeout: 30000 }).catch(async e => {
  await page.screenshot({ path: `${OUT}/agent-fail.png` });
  console.log(await page.locator('main + aside, aside').first().innerText().catch(() => ''));
  throw e;
});
check(true, '删楼层弹出确认');
await page.screenshot({ path: `${OUT}/agent-2-approval.png` });
await page.getByRole('button', { name: '不要' }).click();
await page.waitForTimeout(2500);
const levels = await page.evaluate(() => window.artifact.project().levels.map(l => l.name));
check(levels.includes('三层'), `拒绝后楼层还在：${levels.join('、')}`);

await page.waitForTimeout(2000);
const usage = await api(`/projects/${projectId}/usage`);
check(usage.body[0]?.input > 0, `用量已记录：${JSON.stringify(usage.body[0])}`);
const thread = await api(`/projects/${projectId}/chat-thread`);
check(Array.isArray(thread.body) && thread.body.length >= 2, `对话已保存 ${thread.body.length} 条`);
const versions = await api(`/projects/${projectId}/versions`);
check(versions.body.length >= 2, `自动保存了新版本：${versions.body[0]?.summary}`);

// 从零起步：空白方案，一句需求
const blank = await api('/projects', { method: 'POST', body: JSON.stringify({ name: '新房子', template: 'blank' }) });
await api(`/projects/${blank.body.id}/model`, { method: 'PUT', body: JSON.stringify({ modelConfigId: added.body.id }) });
await page.goto(`${BASE}/p/${blank.body.id}`);
await page.waitForFunction(() => window.artifact?.ready);
await page.getByPlaceholder('说说想怎么改…').fill('一家四口，一层，要两间卧室');
await page.getByPlaceholder('说说想怎么改…').press('Enter');
await page.getByText(/^好了。/).first().waitFor({ timeout: 30000 });
const built = await page.evaluate(() => window.artifact.project());
check(built.spaces.length === 5 && built.walls.length >= 10, `从零搭出 ${built.spaces.length} 个房间、${built.walls.length} 面墙`);
check(built.brief.household?.length === 2, '记下了需求');
const issues = await page.evaluate(() => window.artifact.call('check_rules', {}));
check(issues.result.issues.filter(i => i.severity === 'error').length === 0, `规则检查无错误（警告 ${issues.result.issues.length} 条）`);
await page.screenshot({ path: `${OUT}/agent-3-scratch.png` });

check(errors.filter(e => !/GPU stall|THREE\./.test(e)).length === 0, `页面无报错 ${errors.slice(0, 3).join(' | ')}`);
await b.close();
