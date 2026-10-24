# 发布说明

## 首次开源

使用新初始化的 Git 仓库和隐私提交邮箱。提交前检查 `git diff --cached`，
不要复制其他仓库的 `.git` 或本机 `node_modules`。GitHub 仓库先保持私有，
完成下列检查后再公开。删除旧仓库或重建同名仓库不保证旧公开副本全部消失。

## VS Code 官方插件市场（Visual Studio Marketplace）

1. 在 https://marketplace.visualstudio.com/manage 注册发布者；公开展示名可以使用昵称。
2. `package.json` 已配置发布者 ID `rofleed`，发布时使用拥有该发布者权限的账号。
3. 核对 `repository`、`homepage`、`bugs` 指向新仓库。添加图标和实际使用截图；截图不得包含个人路径、邮箱或公司工程。
4. 检查 `attribution/tatoeba.json` 的 `missing` 列表，应为空。官方数据中没有指定作者的句子应如实标记，并保留 Tatoeba 来源与许可证声明。
5. 在 Node 22 环境执行：

   ```sh
   npm ci
   npm run verify
   npm run check:release -- --publish
   npm run package
   npm run check:vsix -- vocab2code-0.9.0.vsix
   ```

6. 在 VS Code 的“扩展 → … → 从 VSIX 安装”安装本次生成的文件。
7. 核对下方人工验收项后，在发布者管理页面上传这个已验收的 VSIX。
   后续自动化发布应将凭据存入 CI 的安全凭据存储，不能提交到仓库。

每次公开发布更新 `version`、`CHANGELOG.md`，然后创建对应 `v<version>` 标签。
CI 模板位于 `.github/verify.yml.example`。当前 Git 推送凭据没有 `workflow` 权限，
所以模板尚未启用。可在 GitHub 网页中将它保存为 `.github/workflows/verify.yml`，
或为推送凭据补齐相应权限后再提交工作流。启用后会在三个桌面系统运行检查，
并生成带短期保留期的 VSIX 工作流产物，不自动上架。
正式发布前可通过 VSIX 测试；`preview: true` 表示当前为预览阶段。

## 人工验收（未勾选表示尚未验证）

- [ ] Windows：安装 VSIX，打开每日模块，播放音频，确认导入与学习进度保存。
- [x] macOS / VS Code 1.123.2：隔离安装 VSIX，自动验证激活、默认隐私设置、每日模块与例句显示、刷新及清除命令。
- [ ] macOS：人工试听发音，确认重启后进度保存。
- [ ] 最低声明版本 VS Code 1.82：重复核心流程。
- [ ] 默认激活、查看词库、标记进度没有语音请求；点击播放才请求。
- [ ] 断网、语音接口失败时给出可理解的状态，阅读与学习进度仍可用。
- [ ] 开启/关闭预加载，清除缓存与日志，确认已关闭的队列不会继续发出请求。
- [ ] 开启/关闭进度同步及重置进度，确认用户可理解数据去向。
- [ ] 用户导入的例句可正常显示与播放。
- [ ] 确认发布包文件清单、许可证、隐私说明和市场截图。

官方发布指南：https://code.visualstudio.com/api/working-with-extensions/publishing-extension
