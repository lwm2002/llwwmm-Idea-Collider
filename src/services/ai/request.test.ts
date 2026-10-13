import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { requestJson } from './openaiCompatible';
import { listModels, requestTimeoutSeconds } from './connection';

const settings = {
  enabled: true,
  baseUrl: 'https://mock.invalid/v1',
  apiKey: 'test-secret',
  model: 'slow-model',
};
const schema = z.object({ ok: z.literal(true) });
const reply = () =>
  new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('完整响应的超时与取消', () => {
  it('区分服务商网关超时和响应内容读取失败', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'upstream timeout' } }), { status: 504 }),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(requestJson(settings, 'test', {}, schema)).rejects.toThrow(
      '本地等待时间无法解除网关限制',
    );
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new TypeError('stream disconnected')),
    });
    await expect(requestJson(settings, 'test', {}, schema)).rejects.toThrow(
      'API 已响应，但读取完整结果失败',
    );
  });
  it('默认允许超过原45秒的慢响应，成功后清除计时器', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url, init: RequestInit) =>
          new Promise((resolve) =>
            setTimeout(() => {
              expect(init.signal?.aborted).toBe(false);
              resolve(reply());
            }, 60000),
          ),
      ),
    );
    const pending = requestJson(settings, 'test', {}, schema);
    await vi.advanceTimersByTimeAsync(60000);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['连接阶段', '读取响应阶段'])('%s超时提供中文提示并清理计时器', async (stage) => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init: RequestInit) => {
        const stalled = () =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('signal timed out', 'TimeoutError')),
              { once: true },
            );
          });
        return stage === '连接阶段' ? stalled() : Promise.resolve({ ok: true, json: stalled });
      }),
    );
    const pending = requestJson({ ...settings, requestTimeoutSeconds: 30 }, 'test', {}, schema);
    const assertion = expect(pending).rejects.toThrow('AI 请求超过 30 秒');
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('已取消的请求不发出，读取中取消与超时明确区分', async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockImplementation((_url, init: RequestInit) =>
      Promise.resolve({
        ok: true,
        json: () =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('cancelled', 'AbortError')),
              { once: true },
            );
          }),
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const pending = requestJson(settings, 'test', {}, schema, controller.signal);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toThrow('请求已取消');
    await expect(requestJson(settings, 'test', {}, schema, controller.signal)).rejects.toThrow(
      '请求已取消',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('模型列表在响应读取阶段超时也能准确报告', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init: RequestInit) =>
        Promise.resolve({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('signal timed out', 'TimeoutError')),
                { once: true },
              );
            }),
        }),
      ),
    );
    const assertion = expect(listModels(settings)).rejects.toThrow('超过 20 秒');
    await vi.advanceTimersByTimeAsync(20000);
    await assertion;
  });
  it('输出截断和非JSON响应有可操作提示，缺少模型时不发请求', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'length', message: { content: '{"ok":' } }],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(requestJson(settings, 'test', {}, schema)).rejects.toThrow('输出被截断');
    fetch.mockResolvedValue(new Response('<html>proxy error</html>'));
    await expect(requestJson(settings, 'test', {}, schema)).rejects.toThrow('API 未返回完整 JSON');
    await expect(requestJson({ ...settings, model: '' }, 'test', {}, schema)).rejects.toThrow(
      '填写模型名称',
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(requestTimeoutSeconds(settings)).toBe(180);
    expect(requestTimeoutSeconds({ ...settings, requestTimeoutSeconds: 300 })).toBe(300);
  });
});
