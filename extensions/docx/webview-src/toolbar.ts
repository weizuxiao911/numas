import { PAGE_THEME_LABELS } from './types';
import type { FitMode, PageTheme, RenderMode } from './types';
import { getButton, getElement, getInput } from './dom';
import { formatBytes } from '../shared/format';

interface ToolbarCallbacks {
  onModeChange(mode: RenderMode): void;
  onSearchToggle(): void;
  onCyclePageTheme(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
  onZoomSet(value: number): void;
}

/**
 * numas 定制: 顶部只保留 visual/text 模式、outline/properties/search 面板开关、
 * page theme; 导出/复制/打印已移除. 缩放走底部 Word 式滑块条 (zoom-out/slider/zoom-in/值).
 */
export class Toolbar {
  private readonly fileName = getElement('file-name');
  private readonly fileSize = getElement('file-size');
  private readonly visualButton = getButton('mode-visual');
  private readonly textButton = getButton('mode-text');
  private readonly searchToggleButton = getButton('search-toggle');
  private readonly pageThemeButton = getButton('page-theme-button');
  private readonly zoomOutButton = getButton('zoom-out');
  private readonly zoomInButton = getButton('zoom-in');
  private readonly zoomSlider = getInput('zoom-slider');
  private readonly zoomValueText = getElement('zoom-value');

  public constructor(callbacks: ToolbarCallbacks) {
    this.visualButton.addEventListener('click', () => callbacks.onModeChange('visual'));
    this.textButton.addEventListener('click', () => callbacks.onModeChange('text'));
    this.searchToggleButton.addEventListener('click', callbacks.onSearchToggle);
    this.pageThemeButton.addEventListener('click', callbacks.onCyclePageTheme);
    this.zoomOutButton.addEventListener('click', callbacks.onZoomOut);
    this.zoomInButton.addEventListener('click', callbacks.onZoomIn);
    this.zoomValueText.addEventListener('click', callbacks.onZoomReset);
    this.zoomSlider.addEventListener('input', () => {
      callbacks.onZoomSet(Number(this.zoomSlider.value));
    });
  }

  public updateDocument(fileName: string, bytes: number): void {
    this.fileName.textContent = fileName;
    this.fileName.title = fileName;
    this.fileSize.textContent = formatBytes(bytes);
  }

  public updateMode(mode: RenderMode): void {
    const visualActive = mode === 'visual';
    this.visualButton.classList.toggle('active', visualActive);
    this.textButton.classList.toggle('active', !visualActive);
    this.visualButton.setAttribute('aria-pressed', String(visualActive));
    this.textButton.setAttribute('aria-pressed', String(!visualActive));
    // Text mode is drawn in the editor's own colours, so a page theme would be
    // a control with nothing to act on.
    this.pageThemeButton.classList.toggle('hidden', !visualActive);
  }

  public updatePageTheme(theme: PageTheme, next: PageTheme): void {
    const label = `Page theme: ${PAGE_THEME_LABELS[theme]} (switch to ${PAGE_THEME_LABELS[next]})`;
    this.pageThemeButton.title = label;
    this.pageThemeButton.setAttribute('aria-label', label);
    this.pageThemeButton.dataset.theme = theme;
  }

  /** 底部缩放条同步: 滑块位置 + 百分比 (fit 模式下也显示派生出的实际值). */
  public updateZoom(zoom: number, _fit: FitMode): void {
    this.zoomValueText.textContent = `${zoom}%`;
    if (document.activeElement !== this.zoomSlider) {
      this.zoomSlider.value = String(zoom);
    }
  }

  // ── 上游调用点兼容 no-op (导出/告警/忙碌态已从工具栏裁剪) ──
  public updateWarnings(_messages: string[]): void {}
  public setBusy(_busy: boolean): void {}
}
