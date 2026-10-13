import { test, expect } from '@playwright/test';
import { initialData } from '../src/services/storage';
import { conceptMap } from '../src/data/concepts';
import { localGenerator } from '../src/services/ai/localGenerator';

test('工作室桌面布局、交换概念和最近实验入口同步真实数据', async ({ page }) => {
  await page.goto('/');
  const sidebar = await page.locator('.studio-sidebar').boundingBox();
  const canvas = await page.locator('.experiment-canvas').boundingBox();
  const inspector = await page.locator('.experiment-inspector').boundingBox();
  if (!sidebar || !canvas || !inspector) throw new Error('工作室主要面板未显示');
  expect(canvas.x).toBeGreaterThan(sidebar.x + sidebar.width);
  expect(inspector.x).toBeGreaterThan(canvas.x + canvas.width);
  const note = page.locator('.concept-whiteboard .react-flow__node').filter({ hasText: '蜂群' });
  const position = await note.getAttribute('style');
  const bounds = await note.boundingBox();
  if (!bounds) throw new Error('概念便签未显示');
  await page.mouse.move(bounds.x + 12, bounds.y + 12);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 70, bounds.y + 42, { steps: 8 });
  await page.mouse.up();
  expect(await note.getAttribute('style')).not.toBe(position);
  await page.getByRole('button', { name: '重新排列概念', exact: true }).click();
  await page.getByRole('button', { name: '交换概念', exact: true }).click();
  await expect(page.locator('.concept-a h2')).toHaveText('金刚石');
  await expect(page.locator('.arena-a strong')).toHaveText('金刚石');
  await expect(page.locator('.concept-b h2')).toHaveText('蜂群');
  await page.reload();
  await expect(page.locator('.arena-a strong')).toHaveText('金刚石');
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('.connection-card')).toHaveCount(8);
  const collisionUrl = page.url();
  await page.getByRole('link', { name: 'Collider', exact: true }).click();
  await page.locator('.recent-experiments a').first().click();
  expect(page.url()).toBe(collisionUrl);
});

test('手机实验台和配置面板切换后，所选概念可以直接开始碰撞', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.experiment-canvas')).toBeVisible();
  await expect
    .poll(async () =>
      page.locator('.concept-whiteboard').evaluate((board) => {
        const bounds = board.getBoundingClientRect();
        return Array.from(board.querySelectorAll('.react-flow__node')).every((node) => {
          const rect = node.getBoundingClientRect();
          return (
            rect.width > 90 &&
            rect.left >= bounds.left &&
            rect.right <= bounds.right &&
            rect.top >= bounds.top &&
            rect.bottom <= bounds.bottom
          );
        });
      }),
    )
    .toBe(true);
  await expect(page.locator('.experiment-inspector')).toBeHidden();
  await page.getByRole('button', { name: '配置概念', exact: true }).click();
  await expect(page.locator('.experiment-inspector')).toBeVisible();
  await page.getByLabel('输入任意概念 A').fill('沙丘');
  await page.getByLabel('输入任意概念 A').press('Enter');
  await page.getByRole('button', { name: '应用概念，回到实验台' }).click();
  await expect(page.locator('.arena-a strong')).toHaveText('沙丘');
  await expect(page.locator('.experiment-inspector')).toBeHidden();
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.getByRole('heading', { name: '沙丘 × 金刚石', exact: true })).toBeVisible();
  await expect(page.locator('.connection-card')).toHaveCount(8);
});

test('旧实验的进程导航留在当前实验，不跳到最新实验', async ({ page }) => {
  const workspace = initialData();
  const connections = await localGenerator.generateConnections(
    conceptMap['蜂群'],
    conceptMap['金刚石'],
    { count: 4 },
  );
  workspace.collisions = ['latest-experiment', 'older-experiment'].map((id) => ({
    id,
    conceptAId: '蜂群',
    conceptBId: '金刚石',
    connections,
    source: 'local' as const,
    createdAt: new Date().toISOString(),
  }));
  await page.goto('/');
  await page.evaluate(
    (data) => localStorage.setItem('idea-collider:v1', JSON.stringify(data)),
    workspace,
  );
  await page.goto('/collision/older-experiment');
  await expect(
    page
      .getByRole('navigation', { name: '实验进程' })
      .getByRole('link', { name: '寻找连接', exact: true }),
  ).toHaveAttribute('href', '/collision/older-experiment');
  await expect(
    page.getByRole('navigation', { name: '实验进程' }).getByText('演化创意'),
  ).toHaveAttribute('aria-disabled', 'true');
});
