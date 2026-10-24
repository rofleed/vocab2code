# 贡献指南

## 词库从哪里加载

id 相同时后者覆盖前者：

1. 内置：插件内的 `data/*.json`
2. 用户目录：`vocab2code: Open User Library Folder`
3. 设置 `vocab2code.libraryPaths`：任意目录或单个 `.json`（支持 `~`）

## 词库格式

Schema：[`schema/library.schema.json`](schema/library.schema.json)，加上 `"$schema"` 可在 VS Code 中获得补全和校验。

```json
{
  "$schema": "https://raw.githubusercontent.com/<owner>/vocab2code/main/schema/library.schema.json",
  "meta": {
    "id": "my-words",
    "name": "My Words",
    "schema": 1,
    "license": "CC BY-SA 4.0",
    "source": "内容来源"
  },
  "words": [
    "abandon",
    {
      "word": "abundant",
      "phonetic": "/əˈbʌndənt/",
      "senses": [
        {
          "pos": "adj.",
          "definition": "丰富的，充裕的",
          "examples": [{ "en": "The region has abundant natural resources.", "zh": "该地区拥有丰富的自然资源。" }]
        }
      ]
    }
  ]
}
```

- 字符串词条（如 `"abandon"`）的音标、释义和例句从词典获取。
- 对象词条原样使用，空的 `phonetic`、没有释义或没有例句的部分从词典补全。
- 不带 `meta` 的纯数组仍然支持，以文件名作为 id。

## 词典格式

Schema：[`schema/dictionary.schema.json`](schema/dictionary.schema.json)。从内置 `dict/` 和用户词库目录旁的 `dictionaries/` 加载，后加载的按单词覆盖。

```json
{
  "meta": { "id": "my-dict", "schema": 1, "license": "...", "source": "..." },
  "entries": {
    "abandon": {
      "phonetic": "/əˈbændən/",
      "senses": [{ "pos": "vt.", "definition": "放弃" }],
      "examples": [{ "en": "...", "zh": "..." }]
    }
  }
}
```

## 内置数据

`dict/ecdict.json` 和 `data/` 中的考试词表由 `tools/build-ecdict.js` 生成：

- 词表来自 [ECDICT](https://github.com/skywind3000/ECDICT) 的考试标签，并非官方大纲。
- 每个词最多 4 条通用释义，去掉 `[医]` 等专业释义和变形说明。
- 内置例句保留，署名记录见 `attribution/tatoeba.json`；来源未核实会阻止分发检查。

```sh
node tools/build-ecdict.js <ecdict.csv>
```

- `ecdict.csv`：[ECDICT 仓库](https://github.com/skywind3000/ECDICT/blob/master/ecdict.csv)
- `--top 20000`：额外收录的高频词数。
- `--tatoeba` 生成例句后，必须使用官方 detailed 与 transcription 导出重新运行 `tools/build-attribution.py`。记录包含中英文句子的 ID、作者、来源链接及修改说明；未匹配来源的句子会阻止分发检查；官方导出中作者为空的记录保留来源链接并标记为 unassigned。
- 内置 `data/` 仅发布字符串词表；个人对象词条和例句请通过用户词库目录导入。

其他脚本（Node 22）：

- `import-apkg.js`：转换 Anki 卡组，用 `inspect-apkg.js` 查看字段顺序
- `enrich-zh.js`、`fill-examples.js`、`translate-zh.js`：调用在线服务补全释义和翻译，**生成的内容仅供个人使用，不要提交**

## 贡献词库须知

- 只提交你有权再分发的内容，并填写 `meta.license` 和 `meta.source`。
- 不接受来自商业书籍或应用的内容（包括例句），例如 kajweb/dict。
- 推荐来源：ECDICT（MIT）、Tatoeba（CC BY 2.0 FR）、Wiktionary（CC BY-SA）。

## 开发

```sh
npm ci
npm run compile      # 构建
npm run typecheck    # 类型检查
npm run verify       # 类型、行为、发布数据检查
npm run package      # 打包，需要 Node 22
npm run check:vsix -- vocab2code-0.9.0.vsix
```

在 VS Code 中按 F5 启动调试窗口。
