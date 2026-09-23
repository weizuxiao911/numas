/**
 * extensions/welcome/WelcomeView.tsx — 开源贡献任务引导页 (codeblitz 官方 welcome 机制)
 *
 * 渲染: 由 runtimeConfig.WelcomePage 注入官方 WelcomeContribution 的 welcome:// tab,
 *   在「未选项目 / 无打开文件」时显示 (官方规则, 见 config/runtime.ts).
 *
 * 场景 (URL 由活动任务页【领取任务】注入):
 *   ?repo=<原仓库 URL>&issue=<issue URL>
 *   1. 读 repo/issue → fetch GitHub API 拿 issue 结构化数据 → 大屏展示
 *   2. 点击 issue 标题/链接 → 新标签页打开 issue 页面
 *   3. 底部按钮 → 触发 chat 执行「开发准备」技能
 *      (只发触发消息 + 任务上下文; 引导流程在远程 skill 里, 不在按钮上捆绑)
 *   4. 无 repo 参数 → 通用欢迎空态 (非任务场景)
 *
 * 跨拓展契约: 用命令 id 字符串 'chatbot.send' 驱动 chat (不 import chat 拓展实现, 守 §2.2 铁律).
 */
import React from 'react';
import { useInjectable } from '@opensumi/ide-core-browser';
import { CommandService } from '@opensumi/ide-core-common';

import { renderMarkdown, renderMermaidBlocks } from '../../infra/markdown';
import { appBaseUrl } from '../../infra/url';
import './welcome.css';

/** 触发 chat 执行 skill 的跨拓展命令 id (chat 拓展注册, 见 extensions/chat/module.ts) */
const CHAT_SEND_COMMAND = 'chatbot.send';
/** 引导流程技能名 (远程分发, 见 numas-skills 仓库) */
const SKILL_ENV = '开发准备';
const SKILL_LOAD = 'Fork克隆';
const SKILL_LOCATE = '排查定位';
const SKILL_DESIGN = '方案设计';
const SKILL_FIX = '执行修复';
const SKILL_PR = '提交PR';

interface IssueInfo {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user?: { login?: string };
  labels?: Array<{ name: string }>;
}

interface TaskInfo {
  /** 原仓库 URL (URL 参数原值) */
  repo: string;
  /** issue URL (URL 参数原值) */
  issue: string;
  /** owner/repo (从 repo URL 解析, GitHub API 用) */
  ownerRepo: string;
  /** issue 编号 (从 issue URL 解析) */
  issueNumber: string;
}

/** 解析 URL ?repo= & ?issue= */
function parseTask(): TaskInfo | null {
  try {
    const sp = new URL(window.location.href).searchParams;
    const repo = sp.get('repo') || '';
    const issue = sp.get('issue') || '';
    if (!repo && !issue) return null;
    const rm = repo.match(/github\.com[/:]([^/?#]+)\/([^/?#]+)/i);
    const ownerRepo = rm ? `${rm[1]}/${rm[2].replace(/\.git$/i, '')}` : '';
    const im = issue.match(/\/issues\/(\d+)/) || issue.match(/^(\d+)$/);
    const issueNumber = im ? im[1] : '';
    return { repo, issue, ownerRepo, issueNumber };
  } catch {
    return null;
  }
}

function isDarkTheme(): boolean {
  try {
    return /dark/i.test(document.documentElement.className);
  } catch {
    return false;
  }
}

export const WelcomeView: React.FC = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const task = React.useMemo(() => parseTask(), []);
  const [info, setInfo] = React.useState<IssueInfo | null>(null);
  const [bodyHtml, setBodyHtml] = React.useState('');
  const [error, setError] = React.useState('');
  const bodyRef = React.useRef<HTMLDivElement | null>(null);

  // 拉取 issue 结构化数据 (GitHub API 直连; CORS 允许, 未鉴权 60/hr)
  // 兜底 (2026-09-22): API 失败/限流 → 走本地 gh 读取 (session.shell 临时会话, 用完即删)
  React.useEffect(() => {
    if (!task?.ownerRepo || !task.issueNumber) return;
    let alive = true;
    fetch(`https://api.github.com/repos/${task.ownerRepo}/issues/${task.issueNumber}`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: IssueInfo) => {
        if (alive) setInfo(d);
      })
      .catch(async (e) => {
        // 兜底: GitHub API 失败 (限流/网络) → 本地 gh 读取
        const viaGh = await readIssueViaGh(task.ownerRepo, task.issueNumber);
        if (!alive) return;
        if (viaGh) {
          setInfo(viaGh);
          setError('');
          return;
        }
        setError(`${String(e?.message || e)} (gh 兜底读取也失败, 可先执行「${SKILL_ENV}」技能检查 gh 安装/授权)`);
      });
    return () => {
      alive = false;
    };
  }, [task]);

  /**
   * 兜底读取: 本地 gh 读 issue (GitHub API 限流/失败时).
   * 走 opencode session.shell: 建临时会话跑 `gh issue view ... --json` → 取输出 → 删会话.
   * (不污染项目会话; gh 用用户本机登录态, 不受 API 未鉴权限流影响)
   */
  async function readIssueViaGh(ownerRepo: string, issueNumber: string): Promise<IssueInfo | null> {
    const base = appBaseUrl();
    if (!base) return null;
    const api = (path: string, init?: RequestInit) =>
      fetch(`${base.replace(/\/+$/, '')}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      });
    let sid = '';
    try {
      const created = await api('/session', { method: 'POST', body: '{}' }).then((r) => r.json());
      sid = created?.id || created?.data?.id || '';
      if (!sid) return null;
      const cmd = `gh issue view ${issueNumber} --repo ${ownerRepo} --json number,title,body,state,url,labels,author`;
      const res = await api(`/session/${sid}/shell`, {
        method: 'POST',
        body: JSON.stringify({ command: cmd, agent: 'build' }),
      }).then((r) => r.json());
      const part = (res?.parts || []).find((p: any) => p?.type === 'tool');
      const out = String(part?.state?.output || '');
      const start = out.indexOf('{');
      const end = out.lastIndexOf('}');
      if (start === -1 || end <= start) return null;
      const d = JSON.parse(out.slice(start, end + 1));
      return {
        number: d.number,
        title: d.title,
        body: d.body,
        state: d.state,
        html_url: d.url,
        user: { login: d.author?.login },
        labels: (d.labels || []).map((l: any) => ({ name: typeof l === 'string' ? l : l?.name })),
      };
    } catch {
      return null;
    } finally {
      if (sid) {
        try {
          await api(`/session/${sid}`, { method: 'DELETE' });
        } catch { /* 清理失败忽略 */ }
      }
    }
  }

  // issue 正文 Markdown 渲染 (与 markdown 预览同一套栈; mermaid 懒渲染)
  React.useEffect(() => {
    if (!info?.body) return;
    let alive = true;
    void renderMarkdown(info.body)
      .then((html) => {
        if (alive) setBodyHtml(html);
      })
      .catch(() => {
        if (alive) setBodyHtml('');
      });
    return () => {
      alive = false;
    };
  }, [info?.body]);

  React.useEffect(() => {
    const el = bodyRef.current;
    if (el && bodyHtml) void renderMermaidBlocks(el, isDarkTheme());
  }, [bodyHtml]);

  /** 触发 chat 执行技能 (跨拓展命令; 只发触发消息 + 任务上下文, 流程在远程 skill) */
  function sendToChat(lines: string[]) {
    void commandService.executeCommand(CHAT_SEND_COMMAND, lines.join('\n'));
  }

  /** 任务上下文行 (仓库 / issue) */
  function taskLines(): string[] {
    const lines: string[] = [];
    if (task?.repo) lines.push(`任务仓库: ${task.repo}`);
    if (task?.issue) lines.push(`任务 issue: ${task.issue}`);
    return lines;
  }

  /** step1 开发准备 → 「开发准备」技能 (gh 安装/授权检查) */
  function stepEnv() {
    sendToChat([`请执行「${SKILL_ENV}」技能。`, ...taskLines()]);
  }

  /**
   * step2 Fork克隆 → 先弹 FilePicker 选 clone 父目录 (方案 A: 用户先选, 再交给 AI) →
   * 触发「Fork克隆」技能 (含目标目录) → 等 clone 完成 → 走 chat 切项目流程.
   */
  function stepLoad() {
    if (!task?.repo) return;
    window.dispatchEvent(
      new CustomEvent('filepicker:request', {
        detail: {
          config: {
            mode: 'open',
            onPick: (items: Array<{ path: string }>) => {
              const parent = items[0]?.path;
              if (!parent) return;
              sendToChat([`请执行「${SKILL_LOAD}」技能。`, ...taskLines(), `clone 目标目录: ${parent}`]);
              const repoName = (task.ownerRepo || task.repo).split('/').filter(Boolean).pop() || '';
              if (repoName) void waitCloneAndSwitch(`${parent.replace(/\/+$/, '')}/${repoName}`);
            },
          },
        },
      }),
    );
  }

  /** 探测路径存在 (fs stat, header 指向该路径) */
  async function pathExists(path: string, rel = '.'): Promise<boolean> {
    const base = appBaseUrl();
    if (!base) return false;
    try {
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/fs/stat?path=${encodeURIComponent(rel)}`, {
        headers: { 'x-opencode-directory': encodeURI(path) },
        cache: 'no-store',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * 等 clone 完成 → 切换项目 (走 chat 的 setProject 命令: 含实例 reload + 会话重载,
   * 直接 setWorkdir 会导致资源管理器/chat 不刷新, 需手动刷新).
   *
   * clone 完成判定 (避免目录刚建就切过去):
   *   1. 等 .git 出现 (clone 开始)
   *   2. 等 .git/index 连续两次探测存在 (checkout 已落地)
   */
  async function waitCloneAndSwitch(projectPath: string) {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 120; i++) {
      await sleep(3000);
      if (await pathExists(projectPath, '.git')) break;
    }
    let stable = 0;
    for (let i = 0; i < 200; i++) {
      await sleep(3000);
      if (await pathExists(projectPath, '.git/index')) {
        stable += 1;
        if (stable >= 2) {
          void commandService.executeCommand('chatbot.setProject', projectPath);
          return;
        }
      } else {
        stable = 0;
      }
    }
  }

  /** step3 排查定位 → 「排查定位」技能 (AI 解释 issue + 引导分析, 不替用户处理) */
  function stepLocate() {
    sendToChat([`请执行「${SKILL_LOCATE}」技能。`, ...taskLines()]);
  }

  /** step4 方案设计 → 「方案设计」技能 (question 确认 + AI 代笔方案文档) */
  function stepDesign() {
    sendToChat([`请执行「${SKILL_DESIGN}」技能。`, ...taskLines()]);
  }

  /** step5 执行修复 → 「执行修复」技能 (按方案执行 + question 决策 + 用户授权) */
  function stepFix() {
    sendToChat([`请执行「${SKILL_FIX}」技能。`, ...taskLines()]);
  }

  /** step6 提交PR → 「提交PR」技能 (验收 + 授权后才提交) */
  function stepPr() {
    sendToChat([`请执行「${SKILL_PR}」技能。`, ...taskLines()]);
  }

  // 无 repo/issue 参数 → 通用欢迎空态
  if (!task) {
    return (
      <div className="numas-welcome">
        <div className="numas-welcome__card numas-welcome__card--plain">
          <div className="numas-welcome__logo" aria-hidden>
            🐮
          </div>
          <h1 className="numas-welcome__title">Numas 工作台</h1>
          <p className="numas-welcome__desc">请从活动任务页领取任务, 或直接选择项目开始。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="numas-welcome">
      <div className="numas-welcome__card">
        <div className="numas-welcome__repo">
          <span className="numas-welcome__repo-icon" aria-hidden>
            📦
          </span>
          <span className="numas-welcome__repo-name">{task.ownerRepo || task.repo}</span>
          {task.issueNumber && <span className="numas-welcome__issue-num">#{task.issueNumber}</span>}
        </div>

        {info ? (
          <>
            <h1 className="numas-welcome__issue-title">
              <a href={info.html_url} target="_blank" rel="noopener noreferrer" title="在新标签页打开 issue">
                {info.title}
              </a>
            </h1>
            <div className="numas-welcome__meta">
              <span className={`numas-welcome__state numas-welcome__state--${info.state}`}>{info.state}</span>
              {info.user?.login && <span className="numas-welcome__author">@{info.user.login}</span>}
              {(info.labels || []).slice(0, 8).map((l) => (
                <span key={l.name} className="numas-welcome__label">
                  {l.name}
                </span>
              ))}
            </div>
            {info.body ? (
              <div className="numas-welcome__body" ref={bodyRef} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            ) : (
              <p className="numas-welcome__desc">(issue 无正文描述)</p>
            )}
          </>
        ) : error ? (
          <p className="numas-welcome__desc numas-welcome__desc--error">issue 加载失败: {error}</p>
        ) : (
          <p className="numas-welcome__desc">正在加载 issue…</p>
        )}
      </div>

      {/* 底部悬浮步骤按钮组 (按时序展开; 点击行为交给用户; 每个按钮触发 chat 执行技能) */}
      <div className="numas-welcome__steps">
        <button type="button" className="numas-welcome__step" onClick={stepEnv}>
          <span className="numas-welcome__step-num">1</span>开发准备
        </button>
        <button type="button" className="numas-welcome__step" onClick={stepLoad}>
          <span className="numas-welcome__step-num">2</span>Fork克隆
        </button>
        <button type="button" className="numas-welcome__step" onClick={stepLocate}>
          <span className="numas-welcome__step-num">3</span>排查定位
        </button>
        <button type="button" className="numas-welcome__step" onClick={stepDesign}>
          <span className="numas-welcome__step-num">4</span>方案设计
        </button>
        <button type="button" className="numas-welcome__step" onClick={stepFix}>
          <span className="numas-welcome__step-num">5</span>执行修复
        </button>
        <button type="button" className="numas-welcome__step" onClick={stepPr}>
          <span className="numas-welcome__step-num">6</span>提交PR
        </button>
      </div>
    </div>
  );
};
