import { test, expect } from '@playwright/test';
import { initialData } from '../src/services/storage';

test('超出原字段上限的概念能完整输入、保存并刷新恢复', async ({ page }) => {
  const category = '跨领域研究'.repeat(10);
  const description = '完整概念简介'.repeat(700);
  const items = Array.from({ length: 13 }, (_, i) => `第${i}项${'详细定义'.repeat(80)}`);
  await page.goto('/');
  await page.getByLabel('输入任意概念 A').fill('长内容保存测试');
  await page.getByLabel('输入任意概念 A').press('Enter');
  await page.getByLabel('领域', { exact: true }).fill(category);
  await expect(page.getByLabel('领域', { exact: true })).toHaveValue(category);
  await page.getByLabel('概念简介', { exact: true }).fill(description);
  await expect(page.getByLabel('概念简介', { exact: true })).toHaveValue(description);
  for (const label of [
    '核心属性（每行一项）',
    '功能或用途（每行一项）',
    '限制与未知（每行一项）',
  ]) {
    await page.getByLabel(label, { exact: true }).fill(items.join('\n'));
  }
  await page.getByLabel('标签（逗号分隔）').fill(items.join('、'));
  await page.getByRole('button', { name: '创建并设为 Concept A' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.concept-a h2')).toHaveText('长内容保存测试');
  const saved = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('idea-collider:v1')!);
    return data.customConcepts.find((c: { name: string }) => c.name === '长内容保存测试');
  });
  expect(saved).toMatchObject({
    category,
    description,
    properties: items,
    functions: items,
    constraints: items,
    tags: items,
  });
  await page.goto('/concepts');
  await page.getByLabel('搜索概念库').fill('长内容保存测试');
  await page.locator('.library-card .card-main').click();
  await expect(page.getByRole('dialog').getByText(description, { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText(items[12], { exact: true })).toHaveCount(3);
});

test('自由输入两种概念，完成碰撞、创意、演化并刷新恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  for (const [side, name, properties] of [
    ['A', '记忆邮局', '情绪分类\n十年后投递\n收件人保管解码钥匙'],
    ['B', '梦境花园', '睡眠周期开放\n情节分支生长\n醒来后逐渐消退'],
  ]) {
    await page.getByLabel(`输入任意概念 ${side}`).fill(name);
    await page.getByLabel(`输入任意概念 ${side}`).press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('核心属性（每行一项）').fill(properties);
    await page.getByRole('button', { name: `创建并设为 Concept ${side}` }).click();
    await expect(page.locator(`.concept-${side.toLowerCase()} h2`)).toHaveText(name);
  }
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '记忆邮局 × 梦境花园', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.connection-card')).toHaveCount(8);
  await page.locator('.connection-card').first().click();
  await expect(page.locator('.idea-card')).toHaveCount(3);
  await page
    .locator('.idea-card')
    .first()
    .getByRole('link', { name: 'EVOLVE', exact: true })
    .click();
  await page.getByRole('button', { name: '更便宜', exact: false }).first().click();
  await expect(page.locator('.version-bar')).toContainText('V2');
  await page.getByRole('button', { name: 'CHALLENGE', exact: true }).click();
  await expect(page.locator('.critic-panel')).toBeVisible();
  await page.reload();
  await expect(page.locator('.version-bar')).toContainText('V2');
  await page.goto('/');
  await expect(page.locator('.concept-a h2')).toHaveText('记忆邮局');
  await page.goto('/concepts');
  await page.getByLabel('搜索概念库').fill('记忆邮局');
  await expect(page.locator('.library-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('手机自由输入、仅名称创建和已有概念复用', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '配置概念', exact: true }).click();
  await page.getByLabel('输入任意概念 A').fill('蜂群');
  await page.getByLabel('输入任意概念 A').press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('输入任意概念 A').fill('还没有被定义的想象');
  await page.getByLabel('输入任意概念 A').press('Enter');
  await page.screenshot({ path: 'test-results/custom-editor-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '创建并设为 Concept A' }).click();
  await expect(page.locator('.concept-a')).toContainText('待确认');
  await page.reload();
  await expect(page.locator('.concept-a h2')).toHaveText('还没有被定义的想象');
});

test('AI拆解可审阅编辑，新增属性依据进入图谱并持久化', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((data) => {
    data.settings = {
      enabled: true,
      baseUrl: 'https://mock.invalid/v1',
      apiKey: 'mock-test',
      model: 'mock',
    };
    localStorage.setItem('idea-collider:v1', JSON.stringify(data));
  }, initialData());
  await page.reload();
  await page.route('https://mock.invalid/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON();
    const { task, input } = JSON.parse(body.messages[1].content);
    const result = task.includes('拆解用户')
      ? {
          concept: {
            name: '错误改名',
            category: '想象',
            description: '虚构的时间通信设定。',
            properties: ['情绪分类', '延迟投递', '收件人持有钥匙'],
            functions: ['时间通信'],
            constraints: ['虚构机制未验证'],
            tags: ['时间'],
            relatedConcepts: ['蜂群'],
          },
        }
      : {
          connections: Array.from({ length: input.count }, (_, i) => ({
            title: `跨概念路径${i}`,
            dimension: ['结构', '行为', '时间', '信息', '体验'][i % 5],
            conceptAProperty: `用户设定的时间邮戳${i}`,
            conceptBProperty: `待核实的晶体特征${i}`,
            basisA: { status: '用户定义', reason: '根据虚构邮局设定提出的具体探索特征。' },
            basisB: { status: '推测', reason: '这是测试用扩展特征，不能视为真实材料性质。' },
            explanation: '创意假设：测试映射，需要独立验证接口与失效条件。',
            novelty: 75,
            plausibility: 30,
          })),
        };
    await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(result) } }] } });
  });
  await page.getByLabel('输入任意概念 A').fill('时间邮局');
  await page.getByLabel('输入任意概念 A').press('Enter');
  await page.getByRole('button', { name: 'AI 拆解概念' }).click();
  await expect(page.getByLabel('核心属性（每行一项）')).toHaveValue(
    '情绪分类\n延迟投递\n收件人持有钥匙',
  );
  await page.getByLabel('核心属性（每行一项）').fill('情绪邮戳\n延迟投递\n收件人持有钥匙');
  await page.getByRole('button', { name: '创建并设为 Concept A' }).click();
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('.connection-card')).toHaveCount(8);
  await expect(page.locator('.connection-card').first()).toContainText('用户定义');
  await expect(
    page.locator('.react-flow__node').filter({ hasText: '用户设定的时间邮戳0' }),
  ).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.connection-insight')).toContainText('不能视为真实材料性质');
});
