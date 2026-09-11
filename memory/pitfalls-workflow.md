## 避坑指南 — git / 协作 / 工作流 / 杂项

#### 4. AI 操作造成的 stray 文件污染项目根

- **问题描述**: playwright mcp 截图默认相对路径或 `/tmp/`, 散落到项目根或子目录, 污染源码/触发 lint warning.
- **复现路径**: `screenshot({path: 'foo.png'})` 不带目录前缀.
- **解决方案**: 截图/落盘 `filename` 一律**绝对路径** `.tmp/<name>.png`; 任何 `> file` / `tee file` 输出必须在 `.tmp/`; 写完一组操作自检 `git status --short` + `ls .tmp/`; stray 立刻 `mv` 到 `.tmp/`. 见 §2.5.

#### 5. AI 静默 commit / push, 用户失去决策权

- **问题描述**: AI 自作主张 `git add` / `git commit` / `git push`, 违反"用户对结果负责 + 用户对 git 操作拍板"原则.
- **复现路径**: AI 完成功能后默认执行 commit + push 双远程, 不走 question 工具.
- **解决方案**: 任何改动后**必须**用 `question` 工具列出提交/推送选项, 等用户拍板; 用户对 git 的提示/认可仅单次有效, 下次改动重新提问. 见 §1.4/§1.5.

#### 6. question 选项缺推荐, 用户必须自己拍板所有选项

- **问题描述**: AI 用 question 工具但选项无推荐标, 用户失去"综合价值最高"参考, 易选错或来回问.
- **复现路径**: 选项平铺无标, 用户从 4-5 个里盲目选.
- **解决方案**: 选项至少包含一项**推荐的可执行的、综合价值最高**的 (标"(推荐)"); 标题简洁不偏移主题. 见 §1.3.

#### 7. 用户提示/认可被跨任务复用, 误以为已批准新动作

- **问题描述**: 用户在某轮认可"提交+双远程推送", AI 把它带到下一轮的所有改动, 跳过 question.
- **复现路径**: 第二轮改动后 AI 直接 `git push`, 没问.
- **解决方案**: 用户对 git 的提示/认可**仅单次有效**, 每轮改动后重新走 question. 见 §1.5 末尾强调.

#### 8. CLI `chromium --no-sandbox` 启动需要 bundle ESM 路径, 误用 CJS 路径

- **问题描述**: 排查工具 `cli/chromium-sandbox-flag.js` 启动 puppeteer 时 bundle 路径写错 (`./bundle.js` 找不到).
- **复现路径**: `node cli/chromium-sandbox-flag.js`.
- **解决方案**: 用 `path.join(__dirname, '../dist/something.cjs')`, ESM 项目入口指向 `dist/index.cjs`.

#### 9. 端口反代 URL 拼接漏 `replace(/\/+$/, '')`, 双斜杠出错

- **问题描述**: `proxyUrl(port)` 拼接 baseUrl + `/proxy/<port>/` 时, baseUrl 含尾斜杠会导致 `http://localhost:24096//proxy/8000/`.
- **复现路径**: `appBaseUrl()` 返回 `/` 或 `http://localhost:24096/`.
- **解决方案**: 拼接前 `replace(/\/+$/, '')`, 见 `proxyUrl()` 实现.

#### 23. 改动收尾用普通文本"询问 git"代替 question 工具 → 用户无法拍板, 等于没问

- **问题描述**: 一轮改动/文档产出完成后, AI 在正文写 "按约定询问 git 操作意向:" 或 "我准备提交, 你 OK 吗?" 就停下, **没有真正调用 `question` 工具**. 这不是可点选的决策弹窗, 用户没法拍板, 违反 §1.4 "改动必反馈".
- **复现路径**: 写完文档/改完代码, 习惯性用一句话收尾代替工具调用; 或用 `question` 问了别的技术问题, 却把 git 选项塞在普通正文里.
- **解决方案**: 收尾**必须显式调用 `question` 工具**, `questions[].options` 里放 git 操作选项 (提交+推送双远程 / 仅提交 / 暂存 / 不操作, 首个推荐项标 "(推荐)"), 等用户点选返回后再执行. 判据: 自查这一轮**有没有发出 `question` 工具调用** — 只输出文字、无工具调用 = 违规. 文档/调研类无代码改动同样适用 (是否提交文档也是 git 决策). 见 §1.4 铁律.
