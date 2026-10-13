import { test, expect } from '@playwright/test';
import { localGenerator } from '../src/services/ai/localGenerator';
test('核心闭环：碰撞、节点交互、三方向创意、演化分支、挑战、收藏与刷新恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '蜂群', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.getByText('REACTION IN PROGRESS')).toBeVisible();
  await expect(page.getByRole('heading', { name: '蜂群 × 金刚石', exact: true })).toBeVisible();
  await expect(page.locator('.connection-card')).toHaveCount(8);
  const collisionUrl = page.url();
  await page.getByRole('button', { name: '收藏', exact: true }).click();
  const node = page.locator('.react-flow__node').filter({ hasText: '分布式缺陷传感网络' }).first();
  const before = await node.getAttribute('style');
  const box = await node.boundingBox();
  if (!box) throw new Error('Missing graph node');
  await page.mouse.move(box.x + 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 50, box.y + 28, { steps: 8 });
  await page.mouse.up();
  expect(await node.getAttribute('style')).not.toBe(before);
  await node.getByRole('button').click();
  await expect(page.locator('.idea-card')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/collision-desktop.png', fullPage: true });
  const first = page.locator('.idea-card').first();
  await first.getByRole('button', { name: '收藏', exact: true }).click();
  await first.getByRole('link', { name: 'EVOLVE', exact: true }).click();
  await expect(page.locator('.version-bar')).toContainText('V1');
  const originalUrl = page.url();
  await page.getByRole('button', { name: '更便宜', exact: false }).first().click();
  await expect(page.locator('.version-bar')).toContainText('V2');
  await expect(page.locator('.idea-details')).toContainText('物料清单');
  await page.getByRole('button', { name: 'CHALLENGE', exact: true }).click();
  await expect(page.locator('.critic-panel')).toContainText('Major Problems');
  await page.getByRole('button', { name: '收藏', exact: true }).click();
  await page.reload();
  await expect(page.locator('.version-bar')).toContainText('V2');
  await page.getByRole('button', { name: 'CHALLENGE', exact: true }).click();
  await expect(page.locator('.critic-panel')).toContainText('Potential Fixes');
  await page.screenshot({ path: 'test-results/evolution-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '上一版本' }).click();
  expect(page.url()).toBe(originalUrl);
  await page.getByRole('button', { name: '去掉AI', exact: false }).first().click();
  await expect(page.locator('.idea-details')).toContainText('不调用推理服务');
  await expect(page.locator('.lineage>button')).toHaveCount(3);
  await page.getByRole('link', { name: 'Favorites', exact: true }).click();
  await page.getByRole('button', { name: /碰撞/ }).click();
  await expect(page.locator('.archive-row')).toHaveCount(1);
  await page.getByRole('link', { name: '打开碰撞' }).click();
  expect(page.url()).toBe(collisionUrl);
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: /演化/ }).click();
  await expect(page.locator('.idea-card')).toHaveCount(2);
  expect(errors).toEqual([]);
});
test('概念库筛选、详情、收藏、指派与搜索', async ({ page }) => {
  await page.goto('/concepts');
  await expect(page.locator('.library-card')).toHaveCount(172);
  await page.getByRole('button', { name: '材料', exact: true }).click();
  await expect(page.locator('.library-card')).toHaveCount(8);
  await page.getByRole('button', { name: /金刚石.*碳原子/ }).click();
  await expect(page.getByRole('dialog')).toContainText('高导热');
  await page.getByRole('dialog').getByRole('button', { name: '收藏', exact: true }).click();
  await page.getByRole('button', { name: '设为 Concept A', exact: true }).click();
  await expect(page.locator('.concept-a h2')).toHaveText('金刚石');
  await page.getByRole('button', { name: '搜索概念', exact: true }).last().click();
  await page.getByRole('textbox', { name: '搜索 Concept B' }).fill('沙丘');
  await page.locator('.picker-results').getByRole('button', { name: '沙丘 自然现象' }).click();
  await expect(page.locator('.concept-b h2')).toHaveText('沙丘');
  await page.getByRole('link', { name: 'Favorites', exact: true }).click();
  await expect(page.locator('.library-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.library-card')).toContainText('金刚石');
});
test('灵感模板、老虎机和移动端不溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Inspiration', exact: true }).click();
  await page.getByRole('button', { name: 'SPIN', exact: true }).click();
  await expect(page.getByRole('button', { name: 'SPINNING…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.locator('.template-card').first().click();
  await expect(page.locator('.concept-a .concept-name .tag')).toHaveText('材料');
  await expect(page.locator('.concept-b .concept-name .tag')).toHaveText('生物');
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('.connection-card')).toHaveCount(8);
  await page.locator('.connection-card').first().click();
  await expect(page.locator('.idea-card')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/collision-mobile.png', fullPage: true });
});
test('兼容API实际请求、错误提示和手动离线回退', async ({ page }) => {
  let requests = 0;
  await page.route('https://api.example.test/**', async (route) => {
    requests++;
    const request = route.request();
    expect(request.headers().authorization).toBe('Bearer test-key');
    expect(request.postDataJSON().model).toBe('test-model');
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"error":"test failure"}',
    });
  });
  await page.goto('/settings');
  await page.getByLabel('API Base URL', { exact: true }).fill('https://api.example.test/v1');
  await page.getByLabel('API Key', { exact: true }).fill('test-key');
  await page.getByLabel('Model Name', { exact: true }).fill('test-model');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '保存设置' }).click();
  await page.getByRole('button', { name: '验证模型生成' }).click();
  await expect(page.getByRole('alert')).toContainText('401');
  await page.getByRole('link', { name: 'Collider', exact: true }).click();
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('401');
  await page.getByRole('button', { name: '改用离线生成' }).click();
  await expect(page.locator('.connection-card')).toHaveCount(8);
  await expect(page.locator('.page-heading')).toContainText('本地创意引擎');
  expect(requests).toBe(2);
});
test('工作区导出不含密钥，导入可恢复历史', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('.connection-card')).toHaveCount(8);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('API Key', { exact: true }).fill('never-export-this');
  await page.getByRole('button', { name: '保存设置' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出工作区' }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  if (!stream) throw new Error('No download');
  let raw = '';
  for await (const chunk of stream) raw += chunk.toString();
  expect(raw).not.toContain('never-export-this');
  expect(JSON.parse(raw).collisions).toHaveLength(1);
  await page.getByRole('button', { name: '导入备份' }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect(page.getByText(/备份含 1 次碰撞/)).toBeVisible();
  await page.getByRole('button', { name: '确认替换工作区' }).click();
  await page.reload();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('never-export-this');
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.locator('.archive-row')).toHaveCount(1);
});

test('API成功路径：连接、三类发明、演化与Critic均来自校验后的响应', async ({ page }) => {
  let requests = 0;
  await page.route('https://valid-api.example.test/**', async (route) => {
    requests++;
    const { task, input } = JSON.parse(route.request().postDataJSON().messages[1].content);
    let result: unknown;
    if (task.includes('连接测试')) result = { ok: true };
    else if (task.includes('广泛探索'))
      result = {
        connections: (
          await localGenerator.generateConnections(input.a, input.b, { count: input.count })
        ).map((c, i) => ({
          ...c,
          dimension: ['结构', '行为', '时间', '信息', '社会'][i % 5],
          conceptAProperty: input.a.properties[i % input.a.properties.length],
          conceptBProperty:
            input.b.properties[
              (i + Math.floor(i / input.a.properties.length)) % input.b.properties.length
            ],
          basisA: { status: '已知特征', reason: '这是输入概念的内置特征，用于模拟接口。' },
          basisB: { status: '已知特征', reason: '这是输入概念的内置特征，用于模拟接口。' },
        })),
      };
    else if (task.includes('各一个'))
      result = {
        ideas: await localGenerator.generateIdeas(
          input.a,
          input.b,
          input.connection,
          'untrusted-ai-id',
        ),
      };
    else if (task.includes('实质修改'))
      result = {
        idea: await localGenerator.evolveIdea(input.idea, input.mutation, input.a, input.b),
      };
    else result = await localGenerator.criticizeIdea(input.idea, input.a, input.b);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }),
    });
  });
  await page.goto('/settings');
  await page.getByLabel('API Base URL', { exact: true }).fill('https://valid-api.example.test/v1');
  await page.getByLabel('API Key', { exact: true }).fill('fake-local-test-key');
  await page.getByLabel('Model Name', { exact: true }).fill('test-model');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '保存设置' }).click();
  await page.getByRole('button', { name: '验证模型生成' }).click();
  await expect(page.getByText('连接成功，模型已返回有效 JSON。')).toBeVisible();
  await page.getByRole('link', { name: 'Collider', exact: true }).click();
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('.page-heading')).toContainText('AI 引擎');
  await expect(page.locator('.react-flow__node')).toHaveCount(26);
  await page.locator('.connection-card').first().click();
  await expect(page.locator('.idea-card')).toHaveCount(3);
  await expect(page.locator('.idea-meta').first()).toContainText('AI');
  await page
    .locator('.idea-card')
    .first()
    .getByRole('link', { name: 'EVOLVE', exact: true })
    .click();
  await page.getByRole('button', { name: '加入机械结构', exact: false }).first().click();
  await expect(page.locator('.version-bar')).toContainText('V2');
  await page.getByRole('button', { name: 'CHALLENGE', exact: true }).click();
  await expect(page.locator('.verdict')).toBeVisible();
  await page.reload();
  await expect(page.locator('.version-bar')).toContainText('V2');
  expect(requests).toBe(5);
});
