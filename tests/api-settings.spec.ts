import { test, expect } from '@playwright/test';

test('实际请求配置不泄露密钥，未保存的表单不改变正式生成设置', async ({ page }) => {
  await page.goto('/settings');
  await page
    .getByLabel('API Base URL', { exact: true })
    .fill('https://provider.example.test/custom/v1');
  await page.getByLabel('API Key', { exact: true }).fill('private-test-only-key');
  await page.getByLabel('Model Name', { exact: true }).fill('text-model');
  await page.getByRole('checkbox').first().check();
  await expect(page.locator('.unsaved-api-config')).toBeVisible();
  const summary = page.getByRole('region', { name: '实际请求配置' });
  await expect(summary).toContainText('https://provider.example.test/custom/v1/chat/completions');
  await expect(summary).toContainText('当前仍为本地生成');
  await expect(summary).not.toContainText('private-test-only-key');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.locator('.unsaved-api-config')).toHaveCount(0);
  await expect(summary).toContainText('使用已保存的 API 配置');
  await page.reload();
  await expect(page.getByLabel('Model Name', { exact: true })).toHaveValue('text-model');
});

test('MiMo无需模型名即可发现模型，选择后验证生成并保存', async ({ page }) => {
  const requests: string[] = [];
  await page.route('https://api.xiaomimimo.com/**', async (route) => {
    requests.push(route.request().method());
    expect(route.request().headers()['api-key']).toBe('fake-mimo-key');
    expect(route.request().headers().authorization).toBeUndefined();
    if (route.request().method() === 'GET')
      await route.fulfill({ json: { data: [{ id: 'mimo-test-a' }, { id: 'mimo-test-b' }] } });
    else {
      expect(route.request().postDataJSON().model).toBe('mimo-test-b');
      await route.fulfill({ json: { choices: [{ message: { content: '{"ok":true}' } }] } });
    }
  });
  await page.goto('/settings');
  await page.getByLabel('服务商 / 地址预设').selectOption('mimo');
  await page.getByLabel('API Key', { exact: true }).fill(' Bearer fake-mimo-key ');
  await expect(page.getByLabel('Model Name', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: '测试连接 / 获取模型', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('读取 2 个模型');
  await page.getByLabel('筛选模型').fill('test-b');
  await page.getByLabel('选择模型', { exact: true }).selectOption('mimo-test-b');
  await expect(page.getByLabel('Model Name', { exact: true })).toHaveValue('mimo-test-b');
  await page.getByRole('button', { name: '验证模型生成', exact: true }).click();
  await expect(page.getByText('连接成功，模型已返回有效 JSON。')).toBeVisible();
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Model Name', { exact: true })).toHaveValue('mimo-test-b');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('fake-mimo-key');
  expect(requests).toEqual(['GET', 'POST']);
});

test('通用网关保留地址前缀，修改Key或地址清空过期列表', async ({ page }) => {
  await page.route('https://custom.example.test/**', async (route) => {
    expect(route.request().url()).toBe('https://custom.example.test/service/v3/models');
    expect(route.request().headers().authorization).toBe('Bearer gateway-key');
    await route.fulfill({ json: { data: [{ id: 'gateway-model' }] } });
  });
  await page.goto('/settings');
  await page
    .getByLabel('API Base URL', { exact: true })
    .fill('https://custom.example.test/service/v3/chat/completions');
  await page.getByLabel('API Key', { exact: true }).fill('gateway-key');
  await page.getByRole('button', { name: '测试连接 / 获取模型', exact: true }).click();
  await expect(page.getByLabel('选择模型', { exact: true })).toBeVisible();
  await page.getByLabel('API Key', { exact: true }).fill('changed-key');
  await expect(page.getByLabel('选择模型', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/读取 1 个模型/)).toHaveCount(0);
});

test('列表接口不支持时可手动验证生成，401不泄漏Key', async ({ page }) => {
  await page.route('https://custom.example.test/**', async (route) => {
    if (route.request().method() === 'GET')
      await route.fulfill({ status: 404, json: { error: { message: 'No models endpoint' } } });
    else await route.fulfill({ json: { choices: [{ message: { content: '{"ok":true}' } }] } });
  });
  await page.goto('/settings');
  await page.getByLabel('API Base URL', { exact: true }).fill('https://custom.example.test/v1');
  await page.getByLabel('API Key', { exact: true }).fill('fake-secret');
  await page.getByRole('button', { name: '测试连接 / 获取模型', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('404');
  await page.getByLabel('Model Name', { exact: true }).fill('manual-model');
  await page.getByRole('button', { name: '验证模型生成', exact: true }).click();
  await expect(page.getByText('连接成功，模型已返回有效 JSON。')).toBeVisible();
  await page.route('https://custom.example.test/**', (route) =>
    route.fulfill({ status: 401, json: { error: { message: 'Wrong key fake-secret' } } }),
  );
  await page.getByRole('button', { name: '测试连接 / 获取模型', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('401');
  await expect(page.getByRole('alert')).not.toContainText('fake-secret');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/settings-mobile.png', fullPage: true });
});

test('请求期间更改地址，旧响应不能显示成新服务的模型', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrived!: () => void;
  const started = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  await page.route('https://slow.example.test/**', async (route) => {
    arrived();
    await gate;
    await route.fulfill({ json: { data: [{ id: 'stale-model' }] } });
  });
  await page.goto('/settings');
  await page.getByLabel('API Base URL', { exact: true }).fill('https://slow.example.test/v1');
  await page.getByRole('button', { name: '测试连接 / 获取模型', exact: true }).click();
  await started;
  await page.getByLabel('API Base URL', { exact: true }).fill('https://new.example.test/v1');
  release();
  await expect(
    page.getByRole('button', { name: '测试连接 / 获取模型', exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel('选择模型', { exact: true })).toHaveCount(0);
  await expect(page.getByText('stale-model')).toHaveCount(0);
});
