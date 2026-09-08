/**
 * ChatbotMain — chat 主区 UI (vsix 拓展实现的 React 组件)
 *
 * 装 main 槽. 仿 workbuddy:
 *   - 顶部: 大标题 "Numas, 我帮你" + 副标题
 *   - 模式 tab: 日常办公 / 代码开发
 *   - 建议卡片
 *   - 输入框
 *
 * 占位: 输入/tab/建议 UI 骨架, 不接 agent 后端. 业务接 service/opencode.
 */

import React, { useState } from 'react';

import { APP_CHAT_CONFIG } from '../../config/brand';

interface Mode {
  id: string;
  label: string;
  icon?: string;
}

interface Suggestion {
  icon: string;
  label: string;
}

const MODES: Mode[] = [
  { id: 'office', label: '日常办公', icon: '☕' },
  { id: 'code', label: '代码开发', icon: '⌨️' },
];

const SUGGESTIONS: Suggestion[] = [
  { icon: '🎞️', label: '幻灯片' },
  { icon: '🎥', label: '视频生成' },
  { icon: '🔎', label: '深度研究' },
  { icon: '📄', label: '文档处理' },
  { icon: '📊', label: '数据分析' },
  { icon: '📈', label: '可视化' },
];

export const ChatbotMain: React.FC = () => {
  const brand = APP_CHAT_CONFIG.brand;
  const [mode, setMode] = useState<string>('office');
  const [text, setText] = useState<string>('');

  return (
    <div className="app-chatbot">
      <div className="app-chatbot__inner">
        <h1 className="app-chatbot__title">{brand.name}, 我帮你</h1>
        <p className="app-chatbot__subtitle">{brand.subtitle}</p>

        <div className="app-chatbot__modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`app-chatbot__mode${mode === m.id ? ' app-chatbot__mode--active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.icon && <span className="app-chatbot__mode-icon">{m.icon}</span>}
              {m.label}
            </button>
          ))}
        </div>

        <div className="app-chatbot__suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s.label} className="app-chatbot__suggestion">
              <span className="app-chatbot__suggestion-icon">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        <div className="app-chatbot__input">
          <div className="app-chatbot__input-row">
            <button className="app-chatbot__input-icon" title="附件">+</button>
            <input
              className="app-chatbot__input-field"
              type="text"
              placeholder="今天帮你做些什么? @ 引用对话文件, / 调用技能与指令"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && text.trim()) {
                  console.log('[chatbot] send:', text);
                  setText('');
                }
              }}
            />
            <select className="app-chatbot__input-model" defaultValue="hy3">
              <option value="hy3">Hy3</option>
              <option value="m3">M3</option>
            </select>
            <button
              className="app-chatbot__input-send"
              onClick={() => {
                if (text.trim()) {
                  console.log('[chatbot] send:', text);
                  setText('');
                }
              }}
              title="发送"
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
