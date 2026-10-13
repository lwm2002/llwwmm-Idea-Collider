import { test, expect } from '@playwright/test';
import { initialData } from '../src/services/storage';

test('连接数量可选，追加保留创意，分页图谱和刷新恢复', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('首批连接数量').selectOption('4');
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('.connection-card')).toHaveCount(4);
  const original = await page.locator('.connection-card h3').allTextContents();
  await page.locator('.connection-card').first().click();
  await expect(page.locator('.idea-card')).toHaveCount(3);
  await page.getByLabel('追加连接数量').selectOption('12');
  await page.getByRole('button', { name: '继续探索新连接' }).click();
  await expect(page.locator('.connection-card')).toHaveCount(16);
  expect((await page.locator('.connection-card h3').allTextContents()).slice(0, 4)).toEqual(
    original,
  );
  await expect(page.locator('.idea-card')).toHaveCount(3);
  await expect(page.locator('.react-flow__node')).toHaveCount(26);
  await page.getByRole('button', { name: '下一组图谱' }).click();
  await expect(page.getByText('图谱展示第 9–16 条 / 共 16 条')).toBeVisible();
  await page.reload();
  await expect(page.locator('.connection-card')).toHaveCount(16);
  const titles = await page.locator('.connection-card h3').allTextContents();
  expect(new Set(titles).size).toBe(titles.length);
  await page.screenshot({ path: 'test-results/expanded-collision.png', fullPage: true });
});

test('每个概念可单独解释，AI逐项解释保存并刷新恢复', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    (data) =>
      localStorage.setItem(
        'idea-collider:v1',
        JSON.stringify({
          ...data,
          settings: {
            enabled: true,
            baseUrl: 'https://explain.invalid/v1',
            apiKey: 'mock',
            model: 'mock',
          },
        }),
      ),
    initialData(),
  );
  await page.reload();
  let requests = 0;
  await page.route('https://explain.invalid/**', async (route) => {
    requests++;
    const { input } = JSON.parse(route.request().postDataJSON().messages[1].content);
    const c = input.concept;
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                definition: `${c.name}的独立定义示例。`,
                mechanism: `${c.name}的运作原理示例。`,
                examples: [`${c.name}的具体应用示例。`],
                distinctions: '与相邻概念不同，需明确条件和边界。',
                propertyDetails: c.properties.map((p: string) => ({
                  property: p,
                  explanation: `解释${p}的具体含义和成立条件。`,
                })),
                uncertainties: ['此处是模拟结果，未经外部事实核查。'],
              }),
            },
          },
        ],
      },
    });
  });
  await page.getByRole('button', { name: '了解这个概念 →' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('它是什么');
  await page.getByRole('button', { name: 'AI 深入解释每项属性' }).click();
  await expect(page.getByRole('dialog')).toContainText('解释分布式决策的具体含义');
  await page.getByRole('button', { name: '关闭详情' }).click();
  await page.getByRole('button', { name: '了解这个概念 →' }).last().click();
  await expect(page.getByRole('dialog')).toContainText('金刚石');
  await expect(page.getByRole('dialog')).not.toContainText('蜂群的独立定义');
  await page.getByRole('button', { name: 'AI 深入解释每项属性' }).click();
  await expect(page.getByRole('dialog')).toContainText('解释高硬度的具体含义');
  await page.reload();
  await page.getByRole('button', { name: '了解这个概念 →' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('蜂群的独立定义示例');
  expect(requests).toBe(2);
  await page.screenshot({ path: 'test-results/concept-explanation.png', fullPage: true });
});
