/**
 * service/opencode/opencode.service.ts
 *
 * OpencodeServiceImpl — DI 单例实现.
 * bridge: opencode SDK client + runtime 探测 + AI 能力封装.
 *
 * DI 注册:
 *   - AgentModule.providers: [{ token: AgentToken, useClass: OpencodeServiceImpl }, OpencodeServiceImpl]
 *   - 客户端: useInjectable(AgentToken) 或 injector.get(AgentToken)
 *
 * 跨平台:
 *   - shell 探测跨 OS 委托给 opencode 后端 (/pty/shells), 浏览器不靠 UA 猜
 */

import { Injectable } from '@opensumi/di';
import { BrowserModule, ClientAppContribution } from '@opensumi/ide-core-browser';
import { Domain } from '@opensumi/ide-core-common';
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';

import { appBaseUrl, workdirHeader, getEffectiveCwd } from '../../infra/url';
import { normalizeCwdPath } from '../../infra/path';
import { setHostAnchors } from '../../infra/host';
import { isMac, isWindows, isLinux } from '../../infra/os';

import type { IOpencodeService, AgentSession, AgentMessage, AgentModel, AgentRuntime } from './opencode.interface';
import { AgentToken } from './opencode.interface';

let _client: any = null;

@Injectable()
@Domain(ClientAppContribution)
export class OpencodeServiceImpl implements IOpencodeService, ClientAppContribution {
  private _runtime: AgentRuntime | null = null;

  /** 容器启动: 总是跑 initRuntime (探测 cwd/shell/health) */
  onStart(): void {
    void this.initRuntime();
    // 选项目 (workdir) 变化时不重建 SDK client (client 只建一次, 目录由每请求动态 header
    // 拦截器注入); 这里仅同步裸 fetch 用的 runtime.cwd 桥接值.
    if (typeof window !== 'undefined') {
      const syncRuntimeCwd = () => {
        const rt = (window as any).__APP_OPENCODE_RUNTIME__;
        if (rt) rt.cwd = getEffectiveCwd();
      };
      syncRuntimeCwd();
      window.addEventListener('workdir:changed', syncRuntimeCwd);
    }
  }

  /**
   * 初始化 runtime: 探 opencode /global/health + /path + /pty/shells,
   * 注入 defaultShell 到 __APP_CONFIG__, 派发 runtime-ready, 建 SDK client.
   * 幂等: 已初始化则直接返回.
   */
  async initRuntime(): Promise<void> {
    if (this._runtime) return;
    const base = appBaseUrl();
    if (!base) return;
    let sdk: any = null;
    try { sdk = this.getClient(); } catch { /* opencode 未起, 占位即可 */ }

    // 1. /global/health
    let healthy = false;
    try { if (sdk) { const { data } = await sdk.global.health(); healthy = !!(data as any)?.healthy; } }
    catch { /* ignore */ }

    // 2. /path + /pty/shells — 只取 home 锚点 / 默认 shell, 不带业务目录.
    //    /path 的 directory/worktree 只作宿主路径解析底 (setHostAnchors 内由 effectiveCwd
    //    决定工作区根, 未选项目时为空), **不**成为已选项目.
    let hostHome = '';
    let defaultShell = '';
    try {
      if (sdk) {
        const { data } = await sdk.path.get();
        const resp = (data as any) || {};
        if (typeof resp.home === 'string' && resp.home) hostHome = normalizeCwdPath(resp.home);
        // 锚点立即注入: 框架 storage 早期 (建 codeblitz 虚拟家目录 /home/.codeblitz) 等
        // whenHostAnchors 的 home 锚点, 不能被 probeDefaultShell 串行请求拖后.
        setHostAnchors({ home: hostHome });
        defaultShell = await probeDefaultShell(sdk);
      }
    } catch { /* 忽略, 走默认 */ }
    setHostAnchors({ home: hostHome });

    this._runtime = {
      workspace: hostHome,
      defaultShell: defaultShell || '/bin/bash',
      healthy,
    };

    // 注入全局配置 (env / fs-uri / terminal 读这里). 工作目录唯一 source 是 workdir
    // (infra/url getWorkdir), 不注入 cwd.
    (window as any).__APP_CONFIG__ = {
      ...((window as any).__APP_CONFIG__ || {}),
      defaultShell: this._runtime.defaultShell,
    };

    // 派发 runtime-ready
    window.dispatchEvent(new CustomEvent('runtime-ready', { detail: this._runtime }));
    try {
      this.getClient();
      console.log('[opencode] runtime applied:', this._runtime);
    } catch (err) {
      console.warn('[opencode] client 实例化失败:', err);
    }
  }

 getClient(): any {
    // SDK client 只建一次 (单例), 不随 workdir 切换重建.
    // 目录只通过每请求动态注入的 x-opencode-directory header 传递 (不用 config.directory /
    // ?directory= query): 注册一个 request interceptor, 发请求时实时读 getEffectiveCwd(),
    // 这样选项目即时生效, 无需重建 client.
    if (_client) return _client;
    const base = appBaseUrl();
    if (!base) return null;
    _client = createOpencodeClient({
      baseUrl: base,
      responseStyle: 'fields',
      throwOnError: true,
    });
    // numas: 接管 SDK 请求: 设 x-opencode-directory header + 把 query 拼到 URL.
    // SDK 默认 rewrite 拦截器会从 config.directory 转 header 为 query, numas 不传 directory,
    // 默认拦截器被清掉后 SDK 既不设 header 也不拼 query, 显式接管两者.
    try {
      const innerClient: any = (typeof _client?.client === 'object' && (_client as any).client) || _client;
      if (innerClient?.interceptors?.request?.clear) {
        innerClient.interceptors.request.clear();
        innerClient.interceptors.request.use(async (request: Request) => {
          // 注入 x-opencode-directory header (browser fetch ISO-8859-1 限制, encodeURI)
          for (const [k, v] of Object.entries(workdirHeader())) request.headers.set(k, v);
          // query 已经在 SDK 内部 buildClientParams 拼到 url 上 (实测有效), 不再次处理.
          return request;
        });
      }
    } catch (e) { console.warn('[opencode] install dynamic directory header interceptor failed:', e); }
    (window as any).__APP_OPENCODE__ = _client;
    (window as any).__APP_OPENCODE_RUNTIME__ = { baseUrl: base, cwd: getEffectiveCwd() };
    return _client;
  }

  getRuntime(): AgentRuntime | null { return this._runtime; }
  isReady(): boolean { return !!_client || !!appBaseUrl(); }

  async waitForReady(timeoutMs = 8000): Promise<void> {
    if (this.isReady()) return;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (appBaseUrl()) { this.getClient(); return; }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('opencode client not ready');
  }

  private async withClient<T>(fn: (c: any) => Promise<T>): Promise<T> {
    await this.waitForReady();
    const client = this.getClient();
    if (!client) throw new Error('opencode client not ready');
    return fn(client);
  }

  async createSession(title?: string): Promise<string> {
    return this.withClient(async (c) => {
      const params: any = {};
      if (title) params.id = title;
      const { data, error } = await c.session.create(params);
      if (error) throw error;
      if (!data?.id) throw new Error('session.create 未返回 id');
      return data.id;
    });
  }

  async listSessions(): Promise<AgentSession[]> {
    return this.withClient(async (c) => {
      const { data, error } = await c.session.list();
      if (error) throw error;
      return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    });
  }

  async listMessages(sessionID: string): Promise<AgentMessage[]> {
    return this.withClient(async (c) => {
      const { data, error } = await c.session.messages({ sessionID });
      if (error) throw error;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
      if (data && Array.isArray(data.messages)) return data.messages;
      return [];
    });
  }

  async sendMessage(
    sessionID: string,
    textOrParts: string | unknown[],
    agent?: string,
    model?: unknown,
    variant?: string,
  ): Promise<void> {
    return this.withClient(async (c) => {
      const parts: any[] = typeof textOrParts === 'string'
        ? [{ type: 'text', text: textOrParts }]
        : (textOrParts as any[]);
      const params: any = { sessionID, parts };
      if (agent) params.agent = agent;
      if (model) params.model = model;
      if (variant) params.variant = variant;
      const { error } = await c.session.prompt(params);
      if (error) throw error;
    });
  }

  async abort(sessionID: string): Promise<void> {
    return this.withClient(async (c) => {
      const { error } = await c.session.abort({ sessionID });
      if (error) throw error;
    });
  }

  async deleteSession(sessionID: string): Promise<void> {
    return this.withClient(async (c) => {
      const { error } = await c.session.delete({ sessionID });
      if (error) throw error;
    });
  }

  async listAgents(): Promise<unknown[]> {
    return this.withClient(async (c) => {
      const cwd = getEffectiveCwd();
      const { data, error } = await c.app.agents({ query: { directory: cwd } });
      if (error) throw new Error(`listAgents failed: ${(error as any)?.message || 'unknown'}`);
      return Array.isArray(data) ? (data as unknown[]) : [];
    });
  }

  async listModels(): Promise<AgentModel[]> {
    return this.withClient(async (c) => {
      const cwd = getEffectiveCwd();
      const { data, error } = await c.provider.list({ query: { directory: cwd } });
      if (error) throw new Error(`listModels failed: ${(error as any)?.message || 'unknown'}`);
      const json: any = data || {};
      const all: any[] = Array.isArray(json.all) ? json.all : [];
      const connected = new Set(Array.isArray(json.connected) ? json.connected : []);
      const result: AgentModel[] = [];
      for (const p of all) {
        if (!connected.has(p?.id)) continue;
        const models = p?.models || {};
        for (const mid of Object.keys(models)) {
          const m = models[mid];
          if (!m || m.status !== 'active') continue;
          result.push({ id: m.id || mid, providerID: m.providerID || p.id, name: m.name || mid });
        }
      }
      return result;
    });
  }
}

/** 探测宿主机默认 shell: 从 /pty/shells 取 (跨平台由宿主机 opencode 判定, 不猜浏览器 UA).
 *  macOS 偏好 zsh; Windows 偏好 pwsh; Linux 偏好 bash. 目录由 SDK 动态 header 决定. */
async function probeDefaultShell(sdk: any): Promise<string> {
  try {
    const { data } = await sdk.pty.shells();
    const list = (data as any) as Array<{ name: string; path: string; acceptable: boolean }>;
    if (!Array.isArray(list) || !list.length) return '';
    const acc = list.filter((s) => s.acceptable);
    if (!acc.length) return '';
    const pick = isMac()
      ? (acc.find((s) => /zsh/i.test(s.name)) || acc.find((s) => /bash/i.test(s.name)) || acc[0])
      : isWindows()
        ? (acc.find((s) => /pwsh|powershell/i.test(s.name)) || acc[0])
        : isLinux()
          ? (acc.find((s) => /bash|sh/i.test(s.name)) || acc[0])
          : acc[0];
    return pick.path;
  } catch {
    return '';
  }
}

@Injectable()
export class AgentModule extends BrowserModule {
  providers = [
    { token: AgentToken, useClass: OpencodeServiceImpl },
    OpencodeServiceImpl,
  ];
  contributionProvider = ClientAppContribution;
}