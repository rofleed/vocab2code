# 隐私 / Privacy

## 默认行为

- 查看每日词汇、导入本地词库和标记学习进度不需要联网。
- `vocab2code.audioPrefetch` 默认关闭。点击播放未缓存的内容时，会向外部语音服务发送该单词或句子。启用预加载后，插件激活或词库等配置变化时，会自动发送当天的词汇与例句。
- 语音服务包括有道、Google 翻译以及可选的 Microsoft Edge 朗读接口。服务商可以接收到请求文本、IP 地址及普通请求元数据。Edge 请求失败时会尝试 Google。插件不保证这些非官方接口持续可用。
- `vocab2code.syncProgress` 默认关闭。开启此选项且启用 VS Code Settings Sync 后，单词、学习标记和学习时间会通过 VS Code 同步。本插件没有自建账号、分析或遥测服务。
- 自动预加载和同步设置只接受用户级配置，工程目录不能替用户开启它们。

## 本地存储与清除

- 导入词库保存在扩展全局存储的 `libraries/` 目录。使用 `vocab2code: Open User Library Folder` 查看并删除自己的文件。
- 音频保存在扩展全局存储的 `audio/` 目录。使用 `vocab2code: Clear Audio Cache` 清除。此命令取消排队任务，等待已发出的请求结束后删除缓存；不会撤回已发送给服务商的请求。以后点击播放或开启预加载后可能再次生成缓存。
- 学习进度保存在 VS Code 扩展全局状态。使用 `vocab2code: Reset All Learning Progress` 确认后重置。若希望重置同步数据，请在同步开启时执行并等待 VS Code 同步完成；仅关闭同步不会删除云端已有副本。
- 诊断输出只记录运行状态、耗时和音频大小，不记录单词、句子或原始远程错误信息。使用 `vocab2code: Clear Log` 清除当前输出频道；VS Code 自身保存或用户导出的日志副本不由本命令删除。
- 关闭预加载会停止尚未发出的任务；已发出的网络请求可能继续完成。

## English summary

Reading vocabulary, importing local libraries and marking progress work offline.
Audio preloading and progress sync are off by default. Playing uncached text sends
it to Youdao, Google Translate or optionally Microsoft Edge speech services;
these providers also receive normal request metadata including your IP address.
Opting into preloading sends daily words and examples automatically. Edge can
fall back to Google. These unofficial endpoints may stop working.

Imported libraries, audio and progress are stored locally. Progress is included
in VS Code Settings Sync only when both the extension setting and Settings Sync
are enabled. There is no extension-operated analytics service. Commands allow
clearing audio, current diagnostic output and learning progress. Disabling sync
does not erase previously synced data; disabling preload does not recall requests
already sent. Diagnostic output excludes vocabulary text and raw remote errors.
