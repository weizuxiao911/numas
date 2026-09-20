# 开源贡献业务链路设计

## 核心流程

1. 用户访问“活动任务页”（内容参考 https://antdesign.beta.oscollege.net/os/compete/87, 风格参考 https://workshop.cloudlab.top/），卡片显示活动任务，点击卡片的【领取任务】按钮，进入“开源贡献 AI 工作台”页面（携带任务项目、issue等信息）。使用如下真实项目作为验证：
  - https://github.com/antgroup/vsag/issues/2862
  - https://github.com/antgroup/vsag/issues/2865
  - https://github.com/antgroup/vsag/issues/2867
  - https://github.com/antgroup/vsag/issues/2869
  - https://github.com/antgroup/vsag/issues/2870
  - https://github.com/antgroup/vsag/issues/2871
  - https://github.com/jeandle/jeandle-jdk/issues/620
  - https://github.com/jeandle/jeandle-jdk/issues/621  

2. 进入“开源贡献 AI 工作台”后先检测是否安装 numas 应用程序（通过 numas://scheme 方式唤起），如果未安装提供下载地址，引导安装，直到可以访问接入；如果已安装，接入本地服务器，显示 AI 工作台，实现按 packages/codeblitz 完成，先不用管项目初始化问题，确保“开源贡献 AI 工作台”正常接入到本地 numas 应用程序，将其作为服务器端！

## 注意事项

1. “开源贡献 AI 工作台”是纯 web IDE 项目，部署在平台侧， 通过 numas://scheme 方式唤起用户本地的 numas 作为服务器端。（前后端分离）
2. 如果用户本地未下载 numas 应用程序，需提供下载地址，并引导安装，直到“开源贡献 AI 工作台”可以接入本地 numas 应用程序 API 接口。
3. “活动任务页”（:5173，实现在 test/demo 下）和“开源贡献 AI 工作台”（:7788, 实现在 test/ide 下， 拷贝 packages/codeblitz，使用 webpack 运行，补充前置 numas://scheme 检测和下载引导，直到IDE接入本地 numas 服务器）是两个单独的 web 网站。边界职责说明： 
  - “活动任务页”： 显示业务交互，按参考完成独立站点，终点是“领取任务”按钮
  - “开源贡献 AI 工作台”： 是从点击“领取任务”按钮，到加载 IDE 为止
  - 本地 numas 服务器： 后台运行，仅提供 API 接口