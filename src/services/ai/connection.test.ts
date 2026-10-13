import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiConfigSummary, apiEndpoint, authHeaders, cleanApiKey, listModels } from './connection';
import { requestJson } from './openaiCompatible';
import { initialData, parseImport } from '../storage';
const config = {
  baseUrl: 'https://api.example.test/v1',
  apiKey: ' test-secret ',
  model: '',
  enabled: true,
};
afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('通用模型发现', () => {
  it('诊断配置显示实际地址与认证方式，完全排除密钥', () => {
    const summary = apiConfigSummary({
      ...config,
      apiKey: 'private-value',
      model: 'model-a',
      authMode: 'api-key',
    });
    expect(summary.generationUrl).toBe('https://api.example.test/v1/chat/completions');
    expect(summary.authentication).toBe('api-key');
    expect(JSON.stringify(summary)).not.toContain('private-value');
    expect(summary).not.toHaveProperty('apiKey');
  });
  it('400参数拒绝给出JSON模式检查办法，不误报认证失败', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(response({ error: { message: 'response_format is unsupported' } }, 400)),
    );
    await expect(
      requestJson({ ...config, model: 'model-a' }, 'test', {}, z.object({ ok: z.boolean() })),
    ).rejects.toThrow('关闭“请求 JSON 模式”');
  });
  it.each([
    ['https://api.xiaomimimo.com', 'https://api.xiaomimimo.com/v1/models'],
    ['https://api.deepseek.com/v1/', 'https://api.deepseek.com/v1/models'],
    ['https://api.openai.com/v1/chat/completions', 'https://api.openai.com/v1/models'],
    ['https://gateway.test/prefix/v3/models', 'https://gateway.test/prefix/v3/models'],
    [
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
    ],
    ['http://localhost:1234/v1', 'http://localhost:1234/v1/models'],
  ])('规范化路径并保留服务前缀 %s', (input, expected) => {
    expect(apiEndpoint(input, 'models')).toBe(expected);
  });
  it('无需提前配置模型即可读取去重列表，只请求指定地址', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response({ data: [{ id: 'model-b' }, { id: 'model-a' }, { id: 'model-b' }] }),
      );
    vi.stubGlobal('fetch', fetch);
    expect(await listModels(config)).toEqual(['model-a', 'model-b']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/v1/models');
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer test-secret' },
      redirect: 'error',
    });
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  });
  it('MiMo原生认证，兼容网关Bearer认证，支持手选认证方式', () => {
    expect(authHeaders({ ...config, baseUrl: 'https://api.xiaomimimo.com/v1' })).toEqual({
      'api-key': 'test-secret',
    });
    expect(authHeaders({ ...config, baseUrl: 'https://mimo-proxy.test/v1' })).toEqual({
      Authorization: 'Bearer test-secret',
    });
    expect(authHeaders({ ...config, authMode: 'x-api-key' })).toEqual({
      'x-api-key': 'test-secret',
    });
    expect(authHeaders({ ...config, authMode: 'none' })).toEqual({});
    expect(
      authHeaders({ ...config, baseUrl: 'https://api.xiaomimimo.com/v1', authMode: 'bearer' }),
    ).toEqual({ Authorization: 'Bearer test-secret' });
  });
  it('清除误粘贴的Bearer前缀，拒绝Key中的换行', () => {
    expect(cleanApiKey(' Bearer test-secret  ')).toBe('test-secret');
    expect(() => cleanApiKey('test\nsecret')).toThrow('换行');
  });
  it('401展示平台及原因，不泄露服务器回显的密钥', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ error: { message: 'Invalid key test-secret or tp-another-secret' } }, 401),
        ),
    );
    const error = await listModels(config).catch((e) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('api.example.test');
    expect((error as Error).message).toContain('401');
    expect((error as Error).message).toContain('套餐专用');
    expect((error as Error).message).not.toContain('test-secret');
    expect((error as Error).message).not.toContain('tp-another-secret');
  });
  it('区分不支持模型列表、空列表和格式错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 404)));
    await expect(listModels(config)).rejects.toThrow('可能未提供模型列表');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ data: [] })));
    expect(await listModels(config)).toEqual([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ success: true })));
    await expect(listModels(config)).rejects.toThrow('格式不兼容');
  });
  it('跨域网络错误与401明确区分', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(listModels(config)).rejects.toThrow('未收到 HTTP 认证结果');
  });
  it('允许关闭不受支持的JSON参数，仍校验生成内容', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(response({ choices: [{ message: { content: '{"ok":true}' } }] }));
    vi.stubGlobal('fetch', fetch);
    await requestJson(
      { ...config, model: 'model-a', jsonMode: false },
      'test',
      {},
      z.object({ ok: z.literal(true) }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('response_format');
  });
  it('旧版配置继续可用，新版兼容性设置可以保存和导入', () => {
    expect(parseImport(JSON.stringify(initialData())).settings.authMode).toBeUndefined();
    const data = initialData();
    data.settings = {
      ...data.settings,
      authMode: 'api-key',
      jsonMode: false,
      requestTimeoutSeconds: 300,
    };
    expect(parseImport(JSON.stringify(data)).settings).toMatchObject({
      authMode: 'api-key',
      jsonMode: false,
      requestTimeoutSeconds: 300,
    });
  });
});
