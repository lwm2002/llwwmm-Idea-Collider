import { test, expect, type Page } from '@playwright/test';
import { initialData } from '../src/services/storage';
import { localGenerator } from '../src/services/ai/localGenerator';

const api = 'https://resilience.invalid/v1';
async function configure(page: Page, seconds = 180) {
  await page.goto('/');
  await page.evaluate(
    ({ data, baseUrl, seconds }) => {
      data.settings = {
        enabled: true,
        baseUrl,
        apiKey: 'mock-only',
        model: 'mock-slow',
        requestTimeoutSeconds: seconds,
      };
      localStorage.setItem('idea-collider:v1', JSON.stringify(data));
    },
    { data: initialData(), baseUrl: api, seconds },
  );
  await page.reload();
}
const row = (i: number) => ({
  title: `有效连接${i}`,
  dimension: ['结构/材料', '行为', '时间', '信息'][i % 4],
  conceptAProperty: `蜂群特征${i}${'详细结构定义'.repeat(80)}`,
  conceptBProperty: `金刚石特征${i}${'详细机制定义'.repeat(80)}`,
  basisA: { status: '已知特征', reason: '待核实特征' },
  basisB: { status: '推测', reason: '待验证条件' },
  explanation: '跨领域类比及反证实验，具体机制仍需验证。',
  novelty: 75,
  plausibility: 40,
});

test('部分有效结果形成图谱、提示不足、继续生成创意并刷新恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await configure(page);
  await page.route(`${api}/chat/completions`, async (route) => {
    const { task, input } = JSON.parse(route.request().postDataJSON().messages[1].content);
    const result = task.includes('广泛探索')
      ? { connections: [row(0), row(1), row(2), row(0), { ...row(3), basisA: undefined }] }
      : { ideas: await localGenerator.generateIdeas(input.a, input.b, input.connection, 'mock') };
    await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(result) } }] } });
  });
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('.connection-card')).toHaveCount(3);
  await expect(page.locator('.react-flow__node')).toHaveCount(11);
  await expect(page.getByRole('status')).toContainText('保留 3 条有效连接');
  const heights = await page
    .locator('.lab-node')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(Math.max(...heights)).toBeLessThan(180);
  await page.locator('.connection-card').first().click();
  await expect(page.locator('.idea-card')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.connection-card')).toHaveCount(3);
  await expect(page.locator('.react-flow__node')).toHaveCount(11);
  await expect(page.getByRole('status')).toContainText('保留 3 条有效连接');
  expect(errors).toEqual([]);
  await page
    .locator('.graph-container')
    .screenshot({ path: 'test-results/partial-collision-graph.png' });
});

test('响应读取阶段超时显示中文错误，离线回退生成图谱', async ({ page }) => {
  await page.clock.install();
  await configure(page, 30);
  await page.evaluate((url) => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      if (String(args[0]).startsWith(url)) {
        return {
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              document.body.dataset.responsePending = 'true';
              args[1]?.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('signal timed out', 'TimeoutError')),
                { once: true },
              );
            }),
        } as Response;
      }
      return original(...args);
    };
  }, api);
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-response-pending', 'true');
  await page.clock.fastForward(31000);
  await expect(page.getByRole('alert')).toContainText('AI 请求超过 30 秒');
  await expect(page.getByRole('alert')).not.toContainText('signal timed out');
  await page.getByRole('button', { name: '改用离线生成' }).click();
  await page.clock.fastForward(2000);
  await expect(page.locator('.connection-card')).toHaveCount(8);
  await expect(page.locator('.react-flow__node')).toHaveCount(26);
});

test('整批评分为字符串或缺失时仍生成图谱，未评分发明及刷新可恢复', async ({ page }) => {
  await configure(page);
  let requests = 0;
  await page.route(`${api}/chat/completions`, async (route) => {
    requests++;
    const { task, input } = JSON.parse(route.request().postDataJSON().messages[1].content);
    const result = task.includes('广泛探索')
      ? {
          connections: [
            { ...row(0), novelty: '85', plausibility: '72%' },
            { ...row(1), novelty: '8/10', plausibility: '3/5' },
            { ...row(2), novelty: undefined, plausibility: undefined },
            { ...row(3), novelty: '高', plausibility: false },
          ],
        }
      : {
          ideas: await localGenerator.generateIdeas(input.a, input.b, input.connection, 'mock'),
        };
    await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(result) } }] } });
  });
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('.connection-card')).toHaveCount(4);
  await expect(page.locator('.react-flow__node')).toHaveCount(14);
  await expect(page.locator('.connection-card').first().locator('.connection-score b')).toHaveText(
    '85',
  );
  await expect(page.locator('.connection-card').nth(2).locator('.connection-score b')).toHaveText(
    '未评分',
  );
  await expect(page.getByRole('status')).toContainText('已保留内容并标为“未评分”');
  await page.locator('.connection-card').nth(2).click();
  await expect(page.locator('.idea-card')).toHaveCount(3);
  await expect(page.locator('.idea-card').first().locator('.score b')).toHaveText([
    '未评分',
    '未评分',
    /.+/,
  ]);
  await page.reload();
  await expect(page.locator('.connection-card').nth(2).locator('.connection-score b')).toHaveText(
    '未评分',
  );
  await page.locator('.connection-card').nth(2).click();
  await expect(page.locator('.idea-card')).toHaveCount(3);
  expect(requests).toBe(2);
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('idea-collider:v1')!));
  expect(restored.collisions[0].connections[2].novelty).toBeNull();
  expect(restored.ideas[0].feasibility).toBeNull();
  await page
    .locator('.graph-container')
    .screenshot({ path: 'test-results/unscored-collision-graph.png' });
});

test('长时间等待可直接转离线，不再等到超时，旧响应不能覆盖结果', async ({ page }) => {
  await page.clock.install();
  await configure(page);
  await page.evaluate((url) => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      if (String(args[0]).startsWith(url)) {
        document.body.dataset.requestStarted = 'true';
        return new Promise<Response>((_resolve, reject) => {
          args[1]?.signal?.addEventListener(
            'abort',
            () => {
              document.body.dataset.requestCancelled = 'true';
              reject(new DOMException('cancelled', 'AbortError'));
            },
            { once: true },
          );
        });
      }
      return original(...args);
    };
  }, api);
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-request-started', 'true');
  await page.clock.fastForward(31000);
  await expect(page.getByText(/已等待 31 秒/)).toBeVisible();
  await page.getByRole('button', { name: '停止等待，改用离线生成', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-request-cancelled', 'true');
  await expect(page.locator('.connection-card')).toHaveCount(8);
  await expect(page.locator('.page-heading')).toContainText('本地创意引擎');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('idea-collider:v1')!).collisions.length,
    ),
  ).toBe(1);
});

test('超过45秒的响应仍可成功；取消旧请求后重试不会重复保存', async ({ page }) => {
  await page.clock.install();
  await configure(page);
  let arrived!: () => void;
  const started = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route(`${api}/chat/completions`, async (route) => {
    calls++;
    if (calls === 1) {
      arrived();
      await gate;
    }
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({ connections: Array.from({ length: 8 }, (_, i) => row(i)) }),
            },
          },
        ],
      },
    });
  });
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await started;
  await page.clock.fastForward(60000);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('等待模型完整响应，最长 180 秒…')).toBeVisible();
  await page.getByRole('button', { name: '取消生成', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('请求已取消');
  await page.getByRole('button', { name: '重新尝试' }).click();
  release();
  await expect.poll(() => calls).toBe(2);
  await page.clock.fastForward(2000);
  await expect(page.locator('.connection-card')).toHaveCount(8);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('idea-collider:v1')!).collisions.length,
    ),
  ).toBe(1);
});

test('模型输出截断或全部无效时不保存，重试可以恢复', async ({ page }) => {
  await configure(page);
  let calls = 0;
  await page.route(`${api}/chat/completions`, async (route) => {
    calls++;
    const choice =
      calls === 1
        ? { finish_reason: 'length', message: { content: '{"connections":[' } }
        : {
            message: {
              content: JSON.stringify({
                connections:
                  calls === 2
                    ? [{ ...row(0), basisB: undefined }]
                    : Array.from({ length: 4 }, (_, i) => row(i)),
              }),
            },
          };
    await route.fulfill({ json: { choices: [choice] } });
  });
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('模型输出被截断');
  await page.getByRole('button', { name: '重新尝试' }).click();
  await expect(page.getByRole('alert')).toContainText('basisB');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('idea-collider:v1')!).collisions.length,
    ),
  ).toBe(0);
  await page.getByRole('button', { name: '重新尝试' }).click();
  await expect(page.locator('.connection-card')).toHaveCount(4);
});

test('离开碰撞页面终止请求，不生成迟到的历史记录', async ({ page }) => {
  await configure(page);
  await page.evaluate((url) => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      if (String(args[0]).startsWith(url)) {
        document.body.dataset.requestStarted = 'true';
        return new Promise<Response>((_resolve, reject) => {
          args[1]?.signal?.addEventListener(
            'abort',
            () => {
              document.body.dataset.requestCancelled = 'true';
              reject(new DOMException('cancelled', 'AbortError'));
            },
            { once: true },
          );
        });
      }
      return original(...args);
    };
  }, api);
  await page.getByRole('button', { name: 'COLLIDE', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-request-started', 'true');
  await page.getByRole('link', { name: '返回工作台', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-request-cancelled', 'true');
  await expect(page.getByRole('button', { name: 'COLLIDE', exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('idea-collider:v1')!).collisions.length,
    ),
  ).toBe(0);
});

test('最长等待时间可以保存并在刷新后保留', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByLabel('AI 最长等待时间（秒）')).toHaveValue('180');
  await page.getByLabel('AI 最长等待时间（秒）').fill('300');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('AI 最长等待时间（秒）')).toHaveValue('300');
});
