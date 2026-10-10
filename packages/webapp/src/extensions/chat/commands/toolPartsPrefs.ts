/**
 * 工具卡默认展开配置 — 按用户本地存储
 *
 * 对齐官方 App settings.general.shellToolPartsExpanded / editToolPartsExpanded:
 *   - shell: bash/shell 工具卡默认展开
 *   - edit:  edit/write/patch/apply_patch 工具卡默认展开 (纯删除 diff 始终不默认展开)
 * 用户点击切换后以用户为准 (ToolView: toolOpen ?? defaultOpen)。
 */

const STORAGE_KEY = 'chat.toolParts.v1';

export interface ToolPartsPrefs {
  shell: boolean;
  edit: boolean;
}

const DEFAULTS: ToolPartsPrefs = { shell: false, edit: false };

function load(): ToolPartsPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(prefs: ToolPartsPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('chat:tool-parts-prefs-changed'));
}

let cache: ToolPartsPrefs | null = null;

function get(): ToolPartsPrefs {
  if (!cache) cache = load();
  return cache;
}

function set(next: ToolPartsPrefs) {
  cache = next;
  save(next);
}

export const toolPartsPrefs = {
  get,
  set,
  setShell(v: boolean) {
    set({ ...get(), shell: !!v });
  },
  setEdit(v: boolean) {
    set({ ...get(), edit: !!v });
  },
  /** 订阅变更 (ToolView / 设置面板读取后重渲染) */
  subscribe(cb: () => void): () => void {
    window.addEventListener('chat:tool-parts-prefs-changed', cb);
    return () => window.removeEventListener('chat:tool-parts-prefs-changed', cb);
  },
};
