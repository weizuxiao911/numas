镜像地址： 
yunyan ui：oscollege-registry.cn-hangzhou.cr.aliyuncs.com/oscollege/yunyan:v0.1.5
numas ui：oscollege-registry.cn-hangzhou.cr.aliyuncs.com/oscollege/numas:v0.1.5

挂载配置：
共享：
/home/.config/opencode/ # 挂载 opencode 配置
/home/.numas/ui/   # 挂载 web ui
/home/.numas/exec/ # 挂载 opencode 
/home/.numas/extensions/ # 挂载 vsix拓展 
独享：
/home/.local/share/opencode/  # 挂载用户 opencode 数据，如 sqlite
/home/.local/state/opencode/ # 挂载用户 opencode 状态
/home/.cache/opencode/ # 挂载用户 opencode 缓存
/usr/local/.storage/ # ???