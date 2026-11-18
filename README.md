# dsh-plugins-zh

给 DSH 插件市场索引补中文名：把 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的 format-1 索引重新生成一份，**每个插件都带中文标题**（精选条目人工命名，其余按词表逐词命名），描述沿用上游中文原文。

DSH 官方目录里条目的 `title` 就是 `owner/repo` 这种英文仓库路径，所以「插件 → 发现」里满屏英文。这个索引只改一件事：让 `title` 同时带 `zh`。

## 在 DSH 里使用

1. 打开 DSH → 插件页 → 在「实验性插件」里开启 **自定义插件市场（Custom plugin indexes）**。
2. 打开 **发现** → **添加索引源**，粘贴：

```
https://cdn.jsdelivr.net/gh/OWNER/dsh-plugins-zh@main/index.json
```

（把 `OWNER` 换成这个仓库的账号名。jsDelivr 走 CDN，比 `raw.githubusercontent.com` 和 GitHub Pages 在国内都稳。也可用 `https://cdn.jsdelivr.net/gh/OWNER/dsh-plugins-zh@<tag>/index.json` 固定版本。）

3. 之后的浏览：卡片标题是中文名，分类按钮是中文，排序可按 **GitHub 星标 / 30 天下载 / 最近更新**。搜中文关键词也行（匹配中文描述）。

> 索引内容是第三方插件元数据，DSH 只校验 JSON 格式，不校验条目真伪。安装前请在确认框核对来源（npm 包名@版本 或 git 仓库+commit）。

## 数据说明

| 文件 | 说明 |
|---|---|
| `index.json` | 生成物，format 1 索引，约 5 MB、5600+ 条 |
| `data/words.json` | 英文词 → 中文词 的命名词典（自动命名用） |
| `data/curated.json` | `[包名, 中文名]` 人工命名覆盖，优先级最高 |
| `scripts/build.mjs` | 生成脚本：拉上游索引 + 热度镜像 → 命名 → 校验 → 写 `index.json` |

命名规则：取标题最后一段（去掉 `owner/` 与 `dsh-`/`dsh-plugin-` 前缀），按 `-` `.` `_` 切词；词典命中的词译成中文，未命中的保留原文并首字母大写；一个词都没命中时保留英文 slug。所以名字是「可读」而不是「译文级」——它只帮你认出插件大概是干什么的。

当前覆盖率：约 **68%** 的条目有中文名，其余是纯品牌/专有名词（如 `artcraft`、`jev`），保留英文。

## 更新

- 仓库自带 GitHub Actions：每周一自动拉上游重建并提交（也可在 Actions 页手动 `Run workflow`）。
- 本地重建：

```bash
npm install --no-save @deepseek-ai/dsh-plugin-market-index@latest   # 可选，用于格式校验
node scripts/build.mjs
node scripts/build.mjs --check                                      # 只校验不写文件
```

- 想给某个插件起更好的名字：在 `data/curated.json` 里加一行 `["包名", "中文名"]`，再跑一次 `scripts/build.mjs`。

## 许可

脚本与词典：MIT。索引里的插件元数据来自 awesome-dsh-plugin（CC0-1.0）；热度数字来自社区镜像索引。本仓库只做格式转换，不重新分发插件代码。
