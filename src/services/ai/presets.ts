// Presets are editable addresses, not promises that the account has model access.
export const servicePresets = [
  {
    id: 'custom',
    name: '自定义 / 其他兼容服务',
    url: '',
    note: '填写服务商提供的 OpenAI-compatible Base URL。原生 Anthropic / Gemini 等不同协议需使用兼容网关。',
  },
  {
    id: 'mimo',
    name: '小米 MiMo · 普通 API',
    url: 'https://api.xiaomimimo.com/v1',
    note: '普通按量 API Key 与 Token Plan 专用 Key 不通用。使用套餐时，请替换为控制台对应的专用 Base URL。',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1',
    note: '使用 DeepSeek 开放平台创建的 API Key。',
  },
  {
    id: 'siliconflow',
    name: '硅基流动 · 中国',
    url: 'https://api.siliconflow.cn/v1',
    note: '模型列表可能同时包含语音、图片等模型，请选择支持文字对话的模型。',
  },
  {
    id: 'dashscope',
    name: '阿里云百炼 · 北京 DashScope',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    note: 'Key、地域与业务空间必须匹配。新业务空间请将地址替换为控制台提供的专属域名；模型列表接口可能因服务类型不同而不可用。',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    url: 'https://api.openai.com/v1',
    note: '请选择支持 Chat Completions 的文字模型；列出模型不代表账户已获所有模型的生成权限。',
  },
  {
    id: 'local',
    name: '本机兼容服务',
    url: 'http://localhost:1234/v1',
    note: '适用于 LM Studio 等兼容服务。请按本机实际端口修改，免密服务可留空 Key。',
  },
];
export function inferPreset(base: string): string {
  const normalized = base.trim().replace(/\/+$/, '');
  return servicePresets.find((p) => p.url === normalized)?.id ?? 'custom';
}
