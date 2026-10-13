import { z } from 'zod';
import type { Settings } from '../../types';

/** Normalize endpoint paths without guessing an unknown provider's API prefix. */
export function apiEndpoint(base: string, resource: 'models' | 'chat/completions'): string {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    throw new Error('API Base URL 无效，请填写完整的 https:// 地址。');
  }
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error('请使用 HTTPS 地址；本机服务可使用 HTTP。');
  if (url.username || url.password || url.search || url.hash)
    throw new Error('Base URL 不能包含密码、查询参数或锚点。');
  let path = url.pathname.replace(/\/+$/, '').replace(/\/(?:chat\/completions|models)$/, '');
  if (!path && ['api.xiaomimimo.com', 'api.openai.com', 'api.deepseek.com'].includes(url.hostname))
    path = '/v1';
  url.pathname = `${path}/${resource}`;
  return url.toString();
}

export function cleanApiKey(key: string): string {
  const cleaned = key
    .trim()
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (/\s/.test(cleaned)) throw new Error('API Key 内含空格或换行，请重新复制完整密钥。');
  return cleaned;
}

export function authHeaders(settings: Settings): Record<string, string> {
  const key = cleanApiKey(settings.apiKey);
  if (!key || settings.authMode === 'none') return {};
  let mode = settings.authMode ?? 'auto';
  if (mode === 'auto')
    mode =
      new URL(apiEndpoint(settings.baseUrl, 'models')).hostname === 'api.xiaomimimo.com'
        ? 'api-key'
        : 'bearer';
  return mode === 'bearer' ? { Authorization: `Bearer ${key}` } : { [mode]: key };
}

export async function apiError(response: Response, settings: Settings): Promise<Error> {
  const host = new URL(apiEndpoint(settings.baseUrl, 'models')).host;
  const hints: Record<number, string> = {
    400: '请求参数不被接口接受，请检查模型是否支持文字对话与 JSON 模式。若服务详情明确提到 response_format 或 json_object 不受支持，可在兼容性设置中关闭“请求 JSON 模式”后再验证。',
    422: '服务拒绝了请求参数，请核对模型名称、对话接口和 JSON 模式是否受支持。',
    401: '认证失败：请核对 Key 所属平台、API 地址及密钥是否过期；套餐专用 Key 需要搭配对应的专用地址。这不是模型名称校验结果。',
    403: '当前 Key 没有此接口或模型的访问权限，请检查授权与套餐。',
    402: '账户余额不足，请查看服务商控制台的余额。',
    404: '接口不存在，请核对 Base URL 和路径；服务也可能未提供模型列表接口。',
    405: '服务不支持此接口方法，可能没有提供模型列表接口。',
    429: '额度不足或请求频率受限，请查看服务商控制台。',
    408: '服务商等待请求超时，可重试或减少本轮生成数量。',
    500: '服务商内部错误，请稍后重试。',
    502: '服务商网关未收到有效响应，请稍后重试。',
    503: '服务暂时不可用或繁忙，请稍后重试。',
    504: '服务商网关等待模型超时；本地等待时间无法解除网关限制。可减少生成数量或换用响应更快的模型。',
  };
  let detail = '';
  try {
    const raw: unknown = await response.json();
    const parsed = z
      .object({
        error: z
          .union([
            z.string(),
            z.object({
              message: z.string().optional(),
              code: z.union([z.string(), z.number()]).optional(),
            }),
          ])
          .optional(),
        message: z.string().optional(),
      })
      .safeParse(raw);
    if (parsed.success) {
      const e = parsed.data.error;
      detail = typeof e === 'string' ? e : (e?.message ?? parsed.data.message ?? '');
    }
  } catch {
    /* Do not display untrusted HTML or proxy pages. */
  }
  for (const secret of [settings.apiKey, cleanApiKey(settings.apiKey)])
    if (secret) detail = detail.split(secret).join('[已隐藏密钥]');
  detail = detail
    .replace(/Bearer\s+\S+/gi, 'Bearer [已隐藏]')
    .replace(/\b(?:sk|tp|ttp)-[\w-]+/g, '[已隐藏密钥]')
    .slice(0, 350);
  return new Error(
    `API 返回 ${response.status}（${host}）：${hints[response.status] ?? '请检查服务状态、模型名称和接口兼容性。'}${detail ? ` 服务详情：${detail}` : ''}`,
  );
}

/** Safe to display and share: intentionally excludes the API key. */
export function apiConfigSummary(settings: Settings): {
  modelsUrl: string;
  generationUrl: string;
  authentication: string;
  model: string;
  jsonMode: boolean;
  enabled: boolean;
  timeoutSeconds: number;
} {
  const modelsUrl = apiEndpoint(settings.baseUrl, 'models');
  const authentication =
    settings.authMode === 'none'
      ? '不发送认证'
      : !settings.apiKey.trim()
        ? '未填写密钥'
        : settings.authMode === 'auto' || settings.authMode === undefined
          ? new URL(modelsUrl).hostname === 'api.xiaomimimo.com'
            ? 'api-key'
            : 'Authorization: Bearer'
          : settings.authMode === 'bearer'
            ? 'Authorization: Bearer'
            : settings.authMode;
  return {
    modelsUrl,
    generationUrl: apiEndpoint(settings.baseUrl, 'chat/completions'),
    authentication,
    model: settings.model.trim() || '尚未选择模型',
    jsonMode: settings.jsonMode !== false,
    enabled: settings.enabled,
    timeoutSeconds: requestTimeoutSeconds(settings),
  };
}

export function networkError(error: unknown): Error {
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
    return new Error('请求超时或已取消，请检查网络与服务地址。');
  return new Error(
    '无法连接 API。请检查网络、Base URL 和服务的浏览器跨域（CORS）设置；当前未收到 HTTP 认证结果。',
  );
}

export const DEFAULT_REQUEST_TIMEOUT_SECONDS = 180;
export function requestTimeoutSeconds(settings: Settings): number {
  const value = settings.requestTimeoutSeconds;
  return value !== undefined && Number.isInteger(value) && value >= 30 && value <= 600
    ? value
    : DEFAULT_REQUEST_TIMEOUT_SECONDS;
}

/** Keep the deadline active until the entire response body has been read. */
export async function fetchApiJson(
  settings: Settings,
  url: string,
  init: RequestInit,
  seconds: number,
  signal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, seconds * 1000);
  try {
    controller.signal.throwIfAborted();
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      throw networkError(error);
    }
    if (!response.ok) throw await apiError(response, settings);
    try {
      return await response.json();
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new Error('API 未返回完整 JSON，请检查服务地址和接口兼容性，或重新尝试。');
      if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
        throw networkError(error);
      throw new Error('API 已响应，但读取完整结果失败。请检查网络与服务状态，然后重试。');
    }
  } catch (error) {
    if (signal?.aborted) throw new Error('请求已取消。');
    if (timedOut)
      throw new Error(
        `AI 请求超过 ${seconds} 秒，服务未返回完整结果。可在设置中延长等待时间、减少首批探索数量，或改用离线生成。`,
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

const modelListSchema = z.object({
  data: z.array(z.object({ id: z.string().trim().min(1).max(300) })).max(10000),
});
export async function listModels(settings: Settings, signal?: AbortSignal): Promise<string[]> {
  const url = apiEndpoint(settings.baseUrl, 'models');
  const headers = authHeaders(settings);
  const raw = await fetchApiJson(
    settings,
    url,
    {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      redirect: 'error',
    },
    20,
    signal,
  );
  const parsed = modelListSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error('服务的模型列表格式不兼容，未将其标记为连接成功。可手动填写模型，再验证生成。');
  return [...new Set(parsed.data.data.map((m) => m.id))].sort((a, b) => a.localeCompare(b));
}
