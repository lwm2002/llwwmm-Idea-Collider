import { test, expect } from '@playwright/test';
import { initialData } from '../src/services/storage';
import { conceptMap } from '../src/data/concepts';
import { localGenerator } from '../src/services/ai/localGenerator';

test('备份连接 ID 与图谱内部节点名称相同时仍可生成创意', async ({ page }) => {
  const data = initialData();
  const connections = await localGenerator.generateConnections(
    conceptMap['蜂群'],
    conceptMap['金刚石'],
    { count: 4 },
  );
  const ids = ['a', 'b', 'pa-a', 'pb-b'];
  data.collisions = [
    {
      id: 'imported-collision',
      conceptAId: '蜂群',
      conceptBId: '金刚石',
      connections: connections.map((connection, i) => ({ ...connection, id: ids[i] })),
      createdAt: new Date().toISOString(),
      source: 'local',
    },
  ];
  await page.goto('/');
  await page.evaluate((workspace) => {
    localStorage.setItem('idea-collider:v1', JSON.stringify(workspace));
  }, data);
  await page.goto('/collision/imported-collision');
  await expect(page.locator('.react-flow__node')).toHaveCount(14);
  const nodeIds = await page
    .locator('.react-flow__node')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')));
  expect(new Set(nodeIds).size).toBe(14);
  await page
    .locator('.react-flow__node')
    .filter({ hasText: connections[0].title })
    .getByRole('button')
    .click();
  await expect(page.locator('.idea-card')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.idea-card')).toHaveCount(3);
});

const backup = (name: string, pair: [string, string]) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ ...initialData(), pair })),
});

test('无效备份清除旧确认，重新选择有效备份才可替换', async ({ page }) => {
  await page.goto('/settings');
  const input = page.locator('input[type=file]');
  await input.setInputFiles(backup('old.json', ['沙丘', '数据库']));
  await expect(page.getByRole('button', { name: '确认替换工作区' })).toBeVisible();
  await input.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(page.getByRole('alert')).toContainText('备份格式无效');
  await expect(page.getByRole('button', { name: '确认替换工作区' })).toHaveCount(0);
  await input.setInputFiles(backup('latest.json', ['蜂群', '数据库']));
  await expect(page.getByRole('button', { name: '确认替换工作区' })).toBeVisible();
  await page.getByRole('button', { name: '确认替换工作区' }).click();
  await page.getByRole('link', { name: 'Collider', exact: true }).click();
  await expect(page.locator('.concept-a h2')).toHaveText('蜂群');
  await expect(page.locator('.concept-b h2')).toHaveText('数据库');
});

test('较早备份延迟读完不能覆盖最新文件', async ({ page }) => {
  await page.goto('/settings');
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = function () {
      if (this.name !== 'slow.json') return original.call(this);
      return new Promise<string>((resolve) => {
        Object.assign(window, { finishSlowImport: async () => resolve(await original.call(this)) });
      });
    };
  });
  const input = page.locator('input[type=file]');
  await input.setInputFiles(backup('slow.json', ['沙丘', '数据库']));
  await expect(page.getByRole('button', { name: '确认替换工作区' })).toHaveCount(0);
  await input.setInputFiles(backup('latest.json', ['蜂群', '数据库']));
  await expect(page.getByRole('button', { name: '确认替换工作区' })).toBeVisible();
  await page.evaluate(async () => {
    await (window as unknown as { finishSlowImport: () => Promise<void> }).finishSlowImport();
  });
  await page.getByRole('button', { name: '确认替换工作区' }).click();
  await page.getByRole('link', { name: 'Collider', exact: true }).click();
  await expect(page.locator('.concept-a h2')).toHaveText('蜂群');
  await expect(page.locator('.concept-b h2')).toHaveText('数据库');
});

test('概念库与工作台搜索统一处理大小写、全角字符及字段边界', async ({ page }) => {
  await page.goto('/concepts');
  await page.getByRole('button', { name: '创建概念', exact: true }).click();
  await page.getByLabel('概念名称', { exact: true }).fill('Quantum Lab');
  await page.getByLabel('概念简介', { exact: true }).fill('独立定义');
  await page.getByRole('button', { name: '保存到概念库', exact: true }).click();
  await page.getByRole('button', { name: '关闭详情' }).click();
  await page.getByLabel('搜索概念库').fill(' ｑＵＡＮＴＵＭ　lab ');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await expect(page.locator('.library-card')).toContainText('Quantum Lab');
  await page.getByLabel('搜索概念库').fill('Lab独立');
  await expect(page.locator('.library-card')).toHaveCount(0);
  await page.getByRole('link', { name: 'Collider', exact: true }).click();
  await page.getByRole('button', { name: '搜索概念', exact: true }).first().click();
  await page.getByLabel('搜索 Concept A', { exact: true }).fill(' ｑＵＡＮＴＵＭ　lab ');
  await expect(page.locator('.concept-a .picker-results button')).toHaveCount(2);
  await page
    .locator('.concept-a .picker-results')
    .getByRole('button', { name: 'Quantum Lab 自定义' })
    .click();
  await expect(page.locator('.concept-a h2')).toHaveText('Quantum Lab');
});

test('弹窗锁定背景滚动、保持键盘焦点并在关闭后恢复', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '了解这个概念 →' }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(8, 400);
  await page.mouse.wheel(0, 500);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await dialog.getByRole('button', { name: '设为 Concept B', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '关闭详情' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '设为 Concept B', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});
