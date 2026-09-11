/**
 * annotate 拓展 — 终端执行
 *
 * 「运行代码」: 把 anno 里记录的 command 发到当前活跃终端执行 (无终端则新建).
 */
import type { ITerminalController } from '@opensumi/ide-terminal-next/lib/common';

/** 在终端执行命令 (成功返回 true) */
export async function runInTerminal(terminals: ITerminalController, command: string): Promise<boolean> {
  const cmd = String(command || '').trim();
  if (!cmd) return false;
  try {
    let client = terminals.activeClient;
    if (!client) {
      client = await terminals.createTerminal({});
    }
    if (!client) return false;
    await client.sendText(`${cmd}\n`);
    return true;
  } catch {
    return false;
  }
}
