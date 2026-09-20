export interface TaskCard {
  id: string;
  repo: string;
  owner: string;
  issueNumber: number;
  title: string;
  difficulty: '低' | '中' | '中高' | '高';
  points: number;
  tags: string[];
  summary: string;
  issueUrl: string;
}

/** 硬编码 8 个真实开源任务 (SPEC 验证用), 数据来自对应 GitHub issue. */
export const TASKS: TaskCard[] = [
  {
    id: 'vsag-2862',
    repo: 'antgroup/vsag',
    owner: 'antgroup',
    issueNumber: 2862,
    title: 'Build a Dataset Feature Visualization Tool',
    difficulty: '中高',
    points: 13,
    tags: ['feature', 'C++', 'HDF5', 'AI 辅助'],
    summary:
      '构建可复现的数据集特征分析与可视化工具, 输出带版本号的 JSON 画像报告与自包含 HTML 交互报告, 并增加可选的 AI 辅助解读能力。',
    issueUrl: 'https://github.com/antgroup/vsag/issues/2862',
  },
  {
    id: 'vsag-2865',
    repo: 'antgroup/vsag',
    owner: 'antgroup',
    issueNumber: 2865,
    title: 'Implement HGraph Build Memory Estimation',
    difficulty: '低',
    points: 8,
    tags: ['feature', 'C++', '内存预估'],
    summary:
      '为常用的内存型 HGraph 配置实现首个可用的 EstimateBuildMemory(), 复用现有稳定内存估算并叠加构建期临时内存。',
    issueUrl: 'https://github.com/antgroup/vsag/issues/2865',
  },
  {
    id: 'vsag-2867',
    repo: 'antgroup/vsag',
    owner: 'antgroup',
    issueNumber: 2867,
    title: 'Add Term-Weight Mapping Helpers and an Example for pyvsag SINDI',
    difficulty: '低',
    points: 5,
    tags: ['feature', 'Python', 'SINDI'],
    summary:
      '为 pyvsag 稀疏索引增加确定性的词表构建与 term-weight 转 CSR 的公开辅助函数, 并更新 SINDI 示例为易读的字符串 term。',
    issueUrl: 'https://github.com/antgroup/vsag/issues/2867',
  },
  {
    id: 'vsag-2869',
    repo: 'antgroup/vsag',
    owner: 'antgroup',
    issueNumber: 2869,
    title: 'Make the Index Analysis Tool Installable via pip',
    difficulty: '低',
    points: 5,
    tags: ['feature', 'Python', 'pip'],
    summary: '将索引分析工具改造为可通过 pip 安装的发行包, 完善打包配置与安装文档。',
    issueUrl: 'https://github.com/antgroup/vsag/issues/2869',
  },
  {
    id: 'vsag-2870',
    repo: 'antgroup/vsag',
    owner: 'antgroup',
    issueNumber: 2870,
    title: 'Implement Balanced K-Means Clustering for IVF Partitioning',
    difficulty: '中',
    points: 8,
    tags: ['feature', 'C++', 'IVF', '聚类'],
    summary:
      '为 IVF 分区实现平衡 K-Means 聚类算法, 提升分区均衡性与索引检索性能, 配套测试与文档。',
    issueUrl: 'https://github.com/antgroup/vsag/issues/2870',
  },
  {
    id: 'vsag-2871',
    repo: 'antgroup/vsag',
    owner: 'antgroup',
    issueNumber: 2871,
    title: 'Add a LangChain VectorStore Adapter for pyvsag',
    difficulty: '中',
    points: 8,
    tags: ['feature', 'Python', 'LangChain'],
    summary:
      '为 pyvsag 增加 LangChain VectorStore 适配器, 使 VSAG 索引可直接接入 LangChain 检索链路, 配套示例与文档。',
    issueUrl: 'https://github.com/antgroup/vsag/issues/2871',
  },
  {
    id: 'jeandle-jdk-620',
    repo: 'jeandle/jeandle-jdk',
    owner: 'jeandle',
    issueNumber: 620,
    title: '【2026 开源轻训营专属 Issue】更新 jeandle-jdk-flags.md 文档',
    difficulty: '低',
    points: 3,
    tags: ['docs', '文档'],
    summary: '更新 jeandle-jdk-flags.md 文档, 补充/修正 JDK 编译标志的说明与示例。',
    issueUrl: 'https://github.com/jeandle/jeandle-jdk/issues/620',
  },
  {
    id: 'jeandle-jdk-621',
    repo: 'jeandle/jeandle-jdk',
    owner: 'jeandle',
    issueNumber: 621,
    title: '【2026 开源轻训营专属 Issue】更新 jeandle-llvm-options.md 文档',
    difficulty: '低',
    points: 3,
    tags: ['docs', '文档'],
    summary: '更新 jeandle-llvm-options.md 文档, 补充/修正 LLVM 选项的说明与示例。',
    issueUrl: 'https://github.com/jeandle/jeandle-jdk/issues/621',
  },
];
