/**
 * numas 定制: 工具栏裁剪后部分上游元素不再存在. 缺元素时返回游离 stub (不抛错),
 * 对应控制器自然降级为 no-op — 避免为删除按钮重写整条控制器链路.
 */
export function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`[docx] missing viewer element: ${id} (stub)`);
    return document.createElement('div');
  }
  return element;
}

export function getButton(id: string): HTMLButtonElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLButtonElement)) {
    console.warn(`[docx] missing viewer button: ${id} (stub)`);
    return document.createElement('button');
  }
  return element;
}

export function getInput(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) {
    console.warn(`[docx] missing viewer input: ${id} (stub)`);
    return document.createElement('input');
  }
  return element;
}
