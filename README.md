# vocab2code

简体中文 | [English](README.en.md)

在 VS Code 里"写代码"背单词：每日单词被渲染成一个 TypeScript 模块，路过的人只会看到源代码。

```ts
/**
 * #01  abandon  /ə'bændən/
 */
const abandon = phonetic("/ə'bændən/");
// @vt  放弃, 抛弃
```

## 功能

- 内置中考、高考、四六级、考研、托福、雅思、GRE 词库，带中文释义和中英例句
- 每个单词上方的按钮：▶ 发音 · ✓ 认识 · ✗ 不熟 · ↺ 重置
- 认识的词一段时间内不再出现，不熟的词出现得更频繁
- 支持导入自己的单词表（txt / csv / json / kajweb zip）
- 学习进度在所有词库间共享，可选择随 VS Code 设置同步（默认关闭）

## 使用

需要 VS Code 1.82 或更新版本。

1. `Ctrl+Shift+P` → `vocab2code: Open Daily Module` 打开今天的单词
2. `vocab2code: Switch Library` 切换词库
3. `vocab2code: Import Library` 导入单词表

常用设置：

| 设置 | 默认 | 说明 |
| --- | --- | --- |
| `vocab2code.library` | `ielts` | 当前词库 |
| `vocab2code.dailyCount` | `20` | 每天单词数 |
| `vocab2code.knownCooldownDays` | `7` | "认识"的词跳过几天 |
| `vocab2code.audioAccent` | `us` | `us` 美音 / `uk` 英音 |
| `vocab2code.libraryPaths` | `[]` | 额外加载的词库目录或文件 |

## 导入单词表

- `.txt`：每行一个词，释义自动从内置词典查
- `.csv` / `.tsv`：`word, definition, example, translation`
- `.json`：vocab2code 词库格式，见 [CONTRIBUTING.md](CONTRIBUTING.md)
- [kajweb/dict](https://github.com/kajweb/dict) 的 `.json` / `.zip`（本项目不内置，需自行下载）

导入的词库保存在本地，执行 `vocab2code: Open User Library Folder` 可查看。

## 隐私

默认不预加载音频。点击播放时，未缓存的单词或句子会发送至有道、Google 翻译或 Edge 朗读的非官方接口。自动预加载和学习进度同步均需手动开启。接口可能失效；详见 [隐私说明](PRIVACY.md)，其中包含缓存、日志和进度的清除方法。

## 开发与贡献

构建和打包使用 Node.js 22。发布步骤见 [RELEASING.md](RELEASING.md)。

```sh
npm ci
npm run compile   # 然后在 VS Code 中按 F5
```

词库格式、数据生成脚本和贡献须知见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可

代码 [MIT](LICENSE)。词典来自 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT）。例句来自 Tatoeba（CC BY 2.0 FR），逐句署名见 [attribution/tatoeba.json](attribution/tatoeba.json)；详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
