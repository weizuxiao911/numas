import type { ContributionTask } from "@/types"

const now = "2026-09-11T08:00:00.000Z"

export const seedTasks: ContributionTask[] = [
  {
    taskId: "vsag_2862",
    title: "Build a Dataset Feature Visualization Tool",
    repoUrl: "https://github.com/antgroup/vsag",
    platform: "github",
    issueRef: "#2862",
    issueTitle: "Dataset Feature Visualization Tool",
    issueBody: `构建一个数据集特征可视化工具,支持将向量数据集的分布、聚类质量、距离矩阵等特征以图表形式呈现。

需求:
- 读取常见向量数据集格式(fvecs / bvecs / ivecs)
- 支持 2D / 3D 投影可视化(t-SNE / UMAP / PCA)
- 支持 K-Means 聚类结果叠加显示
- 提供 CLI 与 Python API 两种入口`,
    difficulty: "medium",
    publisher: "蚂蚁集团 vsag 团队",
    publishedAt: now,
    status: "open",
  },
  {
    taskId: "vsag_2865",
    title: "Implement HGraph Build Memory Estimation",
    repoUrl: "https://github.com/antgroup/vsag",
    platform: "github",
    issueRef: "#2865",
    issueTitle: "HGraph Build Memory Estimation",
    issueBody: `为 HGraph 索引构建流程添加内存用量预估,用于构建前预判资源占用。

要点:
- 估算 graph 邻接表 + 向量原始数据 + 临时缓冲的峰值内存
- 与现有 build options(#max_degree、#ef_construction、#block_size_limit)联动
- 输出 JSON / table 两种格式,方便脚本消费
- 误差目标:±15%`,
    difficulty: "hard",
    publisher: "蚂蚁集团 vsag 团队",
    publishedAt: now,
    status: "open",
  },
  {
    taskId: "vsag_2867",
    title: "Add Term-Weight Mapping Helpers and an Example for pyvsag SINDI",
    repoUrl: "https://github.com/antgroup/vsag",
    platform: "github",
    issueRef: "#2867",
    issueTitle: "pyvsag SINDI Term-Weight Helpers",
    issueBody: `为 pyvsag 的 SINDI 索引补充 term-weight 映射相关的辅助函数,并附一个端到端示例。

需求:
- 提供 BM25 / TF-IDF 两种常见映射的实现
- 提供 save/load 映射表的工具函数
- example/ 目录下新增 sindi_term_weight_example.py
- 文档补充到 docs/sindi.md`,
    difficulty: "easy",
    publisher: "蚂蚁集团 vsag 团队",
    publishedAt: now,
    status: "open",
  },
  {
    taskId: "vsag_2869",
    title: "Make the Index Analysis Tool Installable via pip",
    repoUrl: "https://github.com/antgroup/vsag",
    platform: "github",
    issueRef: "#2869",
    issueTitle: "Index Analysis Tool pip Installable",
    issueBody: `把现有 tools/index_analysis/ 目录的 Python 工具改造成标准 pip 包,可通过 \`pip install vsag-analysis\` 安装。

要求:
- 提供 pyproject.toml / setup.py
- 入口脚本可作为 console_scripts 暴露
- 兼容 Python 3.9+
- 提交到 PyPI 测试索引验证可安装`,
    difficulty: "easy",
    publisher: "蚂蚁集团 vsag 团队",
    publishedAt: now,
    status: "open",
  },
  {
    taskId: "vsag_2870",
    title: "Implement Balanced K-Means Clustering for IVF Partitioning",
    repoUrl: "https://github.com/antgroup/vsag",
    platform: "github",
    issueRef: "#2870",
    issueTitle: "Balanced K-Means for IVF",
    issueBody: `为 IVF 索引的分区阶段实现均衡 K-Means 聚类,避免常规 K-Means 出现的 cluster size 极度不均。

要点:
- 基于迭代式 reassignment + size constraint
- 与现有 IVF 训练流程无缝衔接
- 单元测试覆盖随机数据集的 size 偏差 < 5%
- benchmark 与原生 K-Means 比较 recall 与构建耗时`,
    difficulty: "hard",
    publisher: "蚂蚁集团 vsag 团队",
    publishedAt: now,
    status: "open",
  },
  {
    taskId: "vsag_2871",
    title: "Add a LangChain VectorStore Adapter for pyvsag",
    repoUrl: "https://github.com/antgroup/vsag",
    platform: "github",
    issueRef: "#2871",
    issueTitle: "LangChain VectorStore Adapter for pyvsag",
    issueBody: `为 pyvsag 实现 LangChain VectorStore 接口,让用户可在 LangChain 生态中直接使用 vsag 作为后端向量库。

接口要求:
- 实现 add_texts / similarity_search / similarity_search_with_score / from_texts / delete
- 支持 metadata 透传
- 提供 example notebook: langchain_vsag_demo.ipynb
- 文档补充到 docs/integrations.md`,
    difficulty: "medium",
    publisher: "蚂蚁集团 vsag 团队",
    publishedAt: now,
    status: "open",
  },
  {
    taskId: "jeandle_620",
    title: "【2026 开源轻训营专属 Issue】更新 jeandle-jdk-flags.md 文档",
    repoUrl: "https://github.com/jeandle/jeandle-jdk",
    platform: "github",
    issueRef: "#620",
    issueTitle: "更新 jeandle-jdk-flags.md 文档",
    issueBody: `问题描述:
jeandle-docs/jeandle-jdk-flags.md 中描述的 Jeandle 特有 JVM 选项并不完整。

验收标准:
使 jeandle-docs/jeandle-jdk-flags.md 包含全部 Jeandle 特有选项的描述(根据 src/hotspot/share/jeandle/jeandle_globals.hpp)。

目标分支:main
参考资料:src/hotspot/share/jeandle/jeandle_globals.hpp`,
    difficulty: "easy",
    publisher: "蚂蚁开源轻训营(jeandle-jdk)",
    publishedAt: "2026-09-11T03:00:00.000Z",
    status: "open",
  },
  {
    taskId: "jeandle_621",
    title: "【2026 开源轻训营专属 Issue】更新 jeandle-llvm-options.md 文档",
    repoUrl: "https://github.com/jeandle/jeandle-jdk",
    platform: "github",
    issueRef: "#621",
    issueTitle: "更新 jeandle-llvm-options.md 文档",
    issueBody: `问题描述:
jeandle-docs/jeandle-llvm-options.md 中描述的 LLVM opt 选项不完整。

验收标准:
jeandle-docs/jeandle-llvm-options.md 中详细描述 jeandle-inline-callee-ir 选项的含义与使用方式(参考 jeandle-llvm 仓库 llvm/tools/opt/optdriver.cpp)。

目标分支:main`,
    difficulty: "easy",
    publisher: "蚂蚁开源轻训营(jeandle-jdk)",
    publishedAt: "2026-09-11T03:00:00.000Z",
    status: "open",
  },
]

export function findTask(id: string): ContributionTask | undefined {
  return seedTasks.find((t) => t.taskId === id)
}

export function buildTaskContext(task: ContributionTask): string {
  const params = new URLSearchParams({
    task_id: task.taskId,
    repo_url: task.repoUrl,
    issue_ref: task.issueRef,
    credential_ref: `cred_${task.taskId}`,
    callback_url: `${window.location.origin}/__callback`,
    signature: `mock_sig_${task.taskId}_${Date.now()}`,
    metadata: JSON.stringify({
      publisher: task.publisher,
      difficulty: task.difficulty,
    }),
  })
  return params.toString()
}
