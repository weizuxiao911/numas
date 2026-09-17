import type { ContributionTask, AIMessage } from "@/types"

const TEMPLATES: Record<string, (task: ContributionTask) => string> = {
  brief: (task) =>
    `任务简报:\n\n- 问题根因:${task.issueTitle}\n- 目标仓库:${task.repoUrl}\n- 关联 issue:${task.issueRef}\n\n修复思路(候选):\n1. 先定位到问题代码所在文件\n2. 增加 type-only import 的识别分支\n3. 增加对应单元测试覆盖回归场景`,
  root: (task) =>
    `根据 issue 描述,根因大概率在解析 import 语句时未区分 \`import type\` 与 \`import value\`。建议先打开 src/extract/derive/\`ast\`-util.mjs 看 type-only 分支。`,
  fix: (task) =>
    `已基于上述定位生成补丁候选,涉及 2 个文件,共 +14 -3 行。请在编辑器右侧 diff 视图中确认,然后点击 "应用" 落盘。`,
  test: (task) =>
    `测试运行结果:\n- ✅ extract/transpile/typescript.spec.mjs (12 passed)\n- ✅ validate/circular-deps.spec.mjs (3 passed)\n- ❌ extract/transpile/esm.spec.mjs (1 failed)\n\n失败用例已自动附带诊断建议,请在状态栏点击查看。`,
  pr: (task) =>
    `PR 已创建:${task.repoUrl.replace("github.com", "github.com")}/pull/1234\n\n- 标题:fix(dep-cruiser): ignore type-only imports in circular check\n- Body:已自动关联 issue ${task.issueRef}\n- 自检报告:6 passed, 1 failed (已说明原因)`,
}

export function mockAIReply(prompt: string, task: ContributionTask): string {
  const lower = prompt.toLowerCase()
  if (lower.includes("根因") || lower.includes("定位") || lower.includes("哪里")) return TEMPLATES.root(task)
  if (lower.includes("补丁") || lower.includes("修复方案") || lower.includes("代码")) return TEMPLATES.fix(task)
  if (lower.includes("测试") || lower.includes("结果")) return TEMPLATES.test(task)
  if (lower.includes("pr") || lower.includes("提交")) return TEMPLATES.pr(task)
  return TEMPLATES.brief(task)
}

export function makeBriefMessage(task: ContributionTask): AIMessage {
  return {
    id: `ai_${Date.now()}`,
    role: "assistant",
    content: TEMPLATES.brief(task),
    createdAt: new Date().toISOString(),
  }
}
