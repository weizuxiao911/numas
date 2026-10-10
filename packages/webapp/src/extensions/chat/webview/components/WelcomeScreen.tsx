/**
 * WelcomeScreen — 空会话问候 (无消息时)
 *
 * 打字机效果逐字输出问候语 (不读 brand 信息); 组件挂载/新会话时重新播放.
 * 建议卡片仍走 config/brand.ts 的 suggestions (默认空, 不影响问候展示).
 */
import React from 'react';
import { getSuggestions, type ChatSuggestion } from '../../scheme';

const GREETING = '嗨，buddy！今天咱们搞点啥？😊';
/** 按码点切分 (emoji 是代理对, 直接 slice 会短暂出现半个字符) */
const GREETING_CHARS = Array.from(GREETING);
/** 逐字间隔 (ms) / 起播延迟 (ms) */
const TYPE_MS = 140;
const START_DELAY_MS = 320;

export const WelcomeScreen: React.FC<{
  onPick: (prompt: string) => void;
}> = ({ onPick }) => {
  const suggestions: ChatSuggestion[] = getSuggestions().length ? getSuggestions() : [];
  const [typed, setTyped] = React.useState(0);

  React.useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setTyped(i);
      if (i < GREETING_CHARS.length) timer = setTimeout(tick, TYPE_MS);
    };
    timer = setTimeout(tick, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="chat__welcome">
      <h1 className="chat__welcome-title" aria-label={GREETING}>
        {GREETING_CHARS.slice(0, typed).join('')}
        <span className="chat__welcome-caret" aria-hidden />
      </h1>

      <div className="chat__welcome-suggest">
        {suggestions.map((s, i) => (
          <button key={i} className="chat__suggest" onClick={() => onPick(s.prompt)}>
            <span className="chat__suggest-icon">{s.icon}</span>
            <span className="chat__suggest-body">
              <span className="chat__suggest-title">{s.title}</span>
              <span className="chat__suggest-desc">{s.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
