import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  Check,
  Download,
  Upload,
  Eye,
  EyeOff,
  Radio,
  KeyRound,
  HardDrive,
  Trash2,
} from 'lucide-react';
import { useStore } from '../hooks/store';
import { endpoint, requestJson } from '../services/ai/openaiCompatible';
import {
  apiConfigSummary,
  cleanApiKey,
  listModels,
  requestTimeoutSeconds,
} from '../services/ai/connection';
import { inferPreset, servicePresets } from '../services/ai/presets';
import type { Settings as ApiSettings } from '../types';
import { exportWorkspace, parseImport } from '../services/storage';
import { PageTitle, Loading } from '../components/ui';
export default function Settings() {
  const { data, update, notify } = useStore();
  const [form, setForm] = useState(data.settings);
  const [visible, setVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testKind, setTestKind] = useState<'models' | 'generation'>('models');
  const [preset, setPreset] = useState(() => inferPreset(data.settings.baseUrl));
  const [models, setModels] = useState<string[] | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const requestId = useRef(0);
  const importId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      requestId.current++;
      importId.current++;
      controller.current?.abort();
    },
    [],
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof parseImport> | null>(null);
  const [importing, setImporting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const unsaved = (Object.keys(form) as (keyof ApiSettings)[]).some(
    (key) => form[key] !== data.settings[key],
  );
  let configuration: ReturnType<typeof apiConfigSummary> | null = null;
  try {
    configuration = apiConfigSummary(form);
  } catch {
    /* The form validation explains invalid addresses. */
  }
  function changeForm(patch: Partial<ApiSettings>) {
    requestId.current++;
    controller.current?.abort();
    setTesting(false);
    setMessage('');
    setError('');
    if ('baseUrl' in patch || 'apiKey' in patch || 'authMode' in patch) {
      setModels(null);
      setModelSearch('');
    }
    setForm((old) => ({ ...old, ...patch }));
  }
  function validate() {
    endpoint(form.baseUrl);
    cleanApiKey(form.apiKey);
    if (form.enabled && !form.model.trim()) throw new Error('启用 AI 时请填写 Model Name。');
    if (
      form.requestTimeoutSeconds !== undefined &&
      (!Number.isInteger(form.requestTimeoutSeconds) ||
        form.requestTimeoutSeconds < 30 ||
        form.requestTimeoutSeconds > 600)
    )
      throw new Error('AI 最长等待时间需要为 30–600 秒之间的整数。');
  }
  function save() {
    try {
      validate();
      const savedForm = {
        ...form,
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        apiKey: cleanApiKey(form.apiKey),
      };
      update((s) => ({
        ...s,
        settings: savedForm,
      }));
      setForm(savedForm);
      setError('');
      notify('设置已保存');
    } catch (e) {
      setError(e instanceof Error ? e.message : '设置无效');
    }
  }
  async function test(kind: 'models' | 'generation') {
    setMessage('');
    setError('');
    const id = ++requestId.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setTestKind(kind);
    setTesting(true);
    if (kind === 'models') setModels(null);
    try {
      endpoint(form.baseUrl);
      const config = { ...form, apiKey: cleanApiKey(form.apiKey) };
      if (kind === 'models') {
        const result = await listModels(config, controller.current.signal);
        if (requestId.current !== id) return;
        setModels(result);
        setMessage(
          result.length
            ? `接口连接成功，读取 ${result.length} 个模型。请选择文字对话模型，再验证生成；列表不代表每个模型都有调用权限。`
            : '接口已响应，但返回了空模型列表。可手动填写模型，再验证生成。',
        );
      } else {
        if (!form.model.trim()) throw new Error('请先从列表选择或手动填写 Model Name。');
        await requestJson(
          config,
          '连接测试，返回 JSON {"ok":true}。',
          {},
          z.object({ ok: z.literal(true) }),
          controller.current.signal,
        );
        if (requestId.current !== id) return;
        setMessage('连接成功，模型已返回有效 JSON。');
      }
    } catch (e) {
      if (requestId.current === id) setError(e instanceof Error ? e.message : '连接失败');
    } finally {
      if (requestId.current === id) setTesting(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="LAB CONFIGURATION"
        title="工作室设置"
        description="离线即可探索全部玩法。连接模型，为碰撞带来更多可能。"
      />
      <div className="settings-layout">
        <section className="settings-card">
          <div className="settings-title">
            <div className="settings-icon">
              <Radio size={22} />
            </div>
            <div>
              <h2>创意引擎</h2>
              <p>OpenAI-compatible API</p>
            </div>
            <span className="tag">{data.settings.enabled ? 'API 已启用' : '本地模式'}</span>
          </div>
          {unsaved && (
            <p className="unsaved-api-config">
              有尚未保存的修改。测试使用当前表单；碰撞与演化仍使用上次保存的配置。确认后点击“保存设置”。
            </p>
          )}
          <label className="toggle-row">
            <div>
              <strong>启用 AI 生成</strong>
              <p>关闭后使用内置本地生成器，无需联网。</p>
            </div>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => changeForm({ enabled: e.target.checked })}
            />
          </label>
          <div className="form-field">
            <label htmlFor="api-provider">服务商 / 地址预设</label>
            <select
              id="api-provider"
              value={preset}
              onChange={(e) => {
                const selected = servicePresets.find((p) => p.id === e.target.value)!;
                setPreset(selected.id);
                changeForm(
                  selected.url ? { baseUrl: selected.url, model: '', authMode: 'auto' } : {},
                );
              }}
            >
              {servicePresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <small>{servicePresets.find((p) => p.id === preset)?.note}</small>
          </div>
          <div className="form-field">
            <label htmlFor="base-url">API Base URL</label>
            <input
              id="base-url"
              value={form.baseUrl}
              placeholder="https://api.openai.com/v1"
              onChange={(e) => {
                setPreset('custom');
                changeForm({ baseUrl: e.target.value });
              }}
            />
            <small>
              填入 API 根地址，查询模型会访问 /models，生成会访问
              /chat/completions。保留服务商要求的路径前缀。
            </small>
          </div>
          <div className="form-field">
            <label htmlFor="api-key">API Key</label>
            <div className="password-input">
              <input
                id="api-key"
                type={visible ? 'text' : 'password'}
                autoComplete="off"
                value={form.apiKey}
                placeholder="填入你的 API Key（本机免密服务可留空）"
                onChange={(e) => changeForm({ apiKey: e.target.value })}
              />
              <button
                className="icon-button"
                aria-label={visible ? '隐藏 API Key' : '显示 API Key'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="button-row discovery-actions">
            <button className="button" disabled={testing} onClick={() => void test('models')}>
              {testing && testKind === 'models' ? (
                <Loading label="获取模型中…" />
              ) : (
                '测试连接 / 获取模型'
              )}
            </button>
            {testing && (
              <button className="text-link" onClick={() => changeForm({})}>
                取消请求
              </button>
            )}
          </div>
          {models !== null && (
            <section className="model-discovery" aria-label="服务返回的模型列表">
              <strong>服务返回的模型 · {models.length}</strong>
              <p>仅查询当前地址，不会将 Key 发送给其他服务商。请选择可用于文字对话的模型。</p>
              {models.length > 0 && (
                <>
                  <input
                    aria-label="筛选模型"
                    placeholder="筛选模型名称…"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                  />
                  <label htmlFor="available-models">选择模型</label>
                  <select
                    id="available-models"
                    value={
                      models.includes(form.model) &&
                      form.model.toLowerCase().includes(modelSearch.toLowerCase())
                        ? form.model
                        : ''
                    }
                    onChange={(e) => {
                      if (e.target.value) changeForm({ model: e.target.value });
                    }}
                  >
                    <option value="">请选择一个模型</option>
                    {models
                      .filter((model) => model.toLowerCase().includes(modelSearch.toLowerCase()))
                      .map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                  </select>
                  {models.every(
                    (model) => !model.toLowerCase().includes(modelSearch.toLowerCase()),
                  ) && <p>没有匹配项，试试其他关键词。</p>}
                </>
              )}
            </section>
          )}
          <div className="form-field">
            <label htmlFor="model-name">Model Name</label>
            <input
              id="model-name"
              value={form.model}
              placeholder="输入服务支持的完整模型名称"
              onChange={(e) => changeForm({ model: e.target.value })}
            />
            <small>
              模型列表不受支持时可手动填写；“验证模型生成”会发送一次小型请求，可能产生服务商费用。
            </small>
          </div>
          <div className="form-field">
            <label htmlFor="request-timeout">AI 最长等待时间（秒）</label>
            <input
              id="request-timeout"
              type="number"
              min={30}
              max={600}
              step={1}
              value={form.requestTimeoutSeconds ?? requestTimeoutSeconds(form)}
              onChange={(e) => changeForm({ requestTimeoutSeconds: Number(e.target.value) })}
            />
            <small>
              适用于概念拆解、碰撞、发明、解释与演化。慢模型可延长等待时间；减少首批探索数量也能减轻生成负担。
            </small>
          </div>
          <details className="api-advanced">
            <summary>兼容性设置</summary>
            <div className="form-field">
              <label htmlFor="auth-mode">认证方式</label>
              <select
                id="auth-mode"
                value={form.authMode ?? 'auto'}
                onChange={(e) =>
                  changeForm({ authMode: e.target.value as ApiSettings['authMode'] })
                }
              >
                <option value="auto">自动（MiMo 使用 api-key，其余使用 Bearer）</option>
                <option value="bearer">Authorization: Bearer</option>
                <option value="api-key">api-key</option>
                <option value="x-api-key">x-api-key</option>
                <option value="none">不发送认证（本机免密服务）</option>
              </select>
            </div>
            <label className="toggle-row">
              <div>
                <strong>请求 JSON 模式</strong>
                <p>接口不支持 response_format 时可关闭；仍要求模型输出 JSON 并校验结构。</p>
              </div>
              <input
                aria-label="请求 JSON 模式"
                type="checkbox"
                checked={form.jsonMode !== false}
                onChange={(e) => changeForm({ jsonMode: e.target.checked })}
              />
            </label>
          </details>
          <section className="api-request-summary" aria-label="实际请求配置">
            <h3>实际请求配置</h3>
            <p>检查本次测试会使用的地址和参数，不显示密钥。</p>
            {configuration ? (
              <dl>
                <div>
                  <dt>获取模型</dt>
                  <dd>
                    <code>{configuration.modelsUrl}</code>
                  </dd>
                </div>
                <div>
                  <dt>生成接口</dt>
                  <dd>
                    <code>{configuration.generationUrl}</code>
                  </dd>
                </div>
                <div>
                  <dt>认证方式</dt>
                  <dd>{configuration.authentication}</dd>
                </div>
                <div>
                  <dt>模型名称</dt>
                  <dd>{configuration.model}</dd>
                </div>
                <div>
                  <dt>JSON 模式</dt>
                  <dd>{configuration.jsonMode ? '开启' : '关闭'}</dd>
                </div>
                <div>
                  <dt>正式生成</dt>
                  <dd>
                    {data.settings.enabled ? '使用已保存的 API 配置' : '当前仍为本地生成'}
                    {unsaved ? '（表单修改尚未应用）' : ''}
                  </dd>
                </div>
              </dl>
            ) : (
              <p>填写有效的 API Base URL 后显示请求地址。</p>
            )}
          </section>
          <div className="settings-notice">
            <KeyRound size={17} />
            <p>
              Key 按你的要求保存在此浏览器的 localStorage
              中，没有加密。启用后，请求直接发往你填写的服务，服务需要允许浏览器跨域访问。只在可信的个人设备上使用；导出备份不包含
              Key。
            </p>
          </div>
          <div className="button-row">
            <button className="button primary" disabled={testing} onClick={save}>
              <Check size={16} />
              保存设置
            </button>
            <button className="button" disabled={testing} onClick={() => void test('generation')}>
              {testing && testKind === 'generation' ? (
                <Loading label="验证生成中…" />
              ) : (
                '验证模型生成'
              )}
            </button>
            <button
              className="text-link"
              disabled={testing}
              onClick={() => {
                changeForm({ apiKey: '', enabled: false });
                update((s) => ({ ...s, settings: { ...s.settings, apiKey: '', enabled: false } }));
                notify('已清除密钥并关闭 AI');
              }}
            >
              <Trash2 size={14} />
              清除 Key
            </button>
          </div>
          {message && (
            <p className="success-message" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside>
          <section className="settings-card storage-card">
            <HardDrive size={25} />
            <h2>本地工作区</h2>
            <p>没有账号，也没有云端同步。收藏与实验记录存储在当前浏览器、当前访问地址下。</p>
            <div className="storage-stats">
              <div>
                <b>{data.collisions.length}</b>
                <span>碰撞</span>
              </div>
              <div>
                <b>{data.ideas.length}</b>
                <span>创意版本</span>
              </div>
              <div>
                <b>{Object.values(data.favorites).flat().length}</b>
                <span>收藏</span>
              </div>
            </div>
            <button className="button full-width" onClick={() => exportWorkspace(data)}>
              <Download size={16} />
              导出工作区
            </button>
            <button className="button full-width" onClick={() => file.current?.click()}>
              <Upload size={16} />
              导入备份
            </button>
            <input
              hidden
              ref={file}
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const input = e.currentTarget;
                const selected = input.files?.[0];
                if (!selected) return;
                const ticket = ++importId.current;
                input.value = '';
                setPendingImport(null);
                setImporting(true);
                setError('');
                try {
                  if (selected.size > 5 * 1024 * 1024) throw new Error('备份文件不能超过 5 MB');
                  const parsed = parseImport(await selected.text());
                  if (ticket !== importId.current) return;
                  setPendingImport(parsed);
                } catch {
                  if (ticket === importId.current)
                    setError('备份格式无效、过大或包含无效记录，当前工作区未改变。');
                } finally {
                  if (ticket === importId.current) setImporting(false);
                }
              }}
            />
            {importing && (
              <p role="status">
                <Loading label="正在读取并校验备份…" />
              </p>
            )}
            {pendingImport && (
              <div className="import-confirm">
                <p>
                  备份含 {pendingImport.collisions.length} 次碰撞、{pendingImport.ideas.length}{' '}
                  个创意。导入将替换工作区，保留当前 API 设置。
                </p>
                <button
                  className="button primary"
                  onClick={() => {
                    update((s) => ({ ...pendingImport, settings: s.settings }));
                    setPendingImport(null);
                    notify('备份已导入');
                  }}
                >
                  确认替换工作区
                </button>
                <button className="button" onClick={() => setPendingImport(null)}>
                  取消
                </button>
              </div>
            )}
          </section>
          <div className="about-note">
            <span className="eyebrow">IDEA COLLIDER / V1.0</span>
            <p>好奇心驱动的概念碰撞实验室。生成结果都是等待验证的起点。</p>
          </div>
        </aside>
      </div>
    </>
  );
}
