---
title: 把 Bun 当作静态网站生成器
date: 2026-01-15
summary: 在金融软件行业做了二十年构建流水线,我学会了不信任依赖。这个网站由 Bun.build、HTMLRewriter 和一个小小的预渲染循环生成,仅此而已。
tags: [bun, ssg]
---

在金融软件行业干了二十年,人会留下职业病:先数依赖,再数功能。我接手过太多构建流水线,一半的包早没人维护,也没人记得当初为何加入。重做在线简历时,规则先于第一行代码写下:构建零依赖,不用
Vite,不用 Webpack,不靠陌生人的善意续命的插件。

## 三项能力,一项不多

Bun 让这条规则负担得起,三项能力足以产出整个网站。

第一是
`Bun.build`,原生打包器。一个入口、一个输出目录、压缩,寥寥几个参数,TypeScript 和
CSS 编译完成,文件名带上缓存指纹。没有要驯服的配置,没有要在周五深夜调试的插件图。

第二是 `HTMLRewriter`,由 Cloudflare Workers 推广、Bun 原生实现的 HTML 转换
API。SEO 标签、`alternate`/`hreflang`
链接、语言协商脚本,都由它在构建期注入文档头部,绝不留到运行时。

第三最平凡,也最关键:Bun 直接运行 TypeScript。渲染函数是纯函数,返回字符串,不碰
DOM,于是每种语言调用一次,用 `Bun.write`
落盘。七种语言,八个页面,英语既作根页面,也单独发布。

预渲染的核心就是这段循环:

```ts
import { renderApp } from "./src/render";
import { LANGS } from "./src/translations";

const result = await Bun.build({
  entrypoints: ["./src/main.ts", "./src/styles.css"],
  outdir: "./dist/assets",
  minify: true,
});
if (!result.success) throw new AggregateError(result.logs, "bundle failed");

for (const lang of LANGS) {
  const html = renderApp(lang); // pure string output, no DOM involved
  const page = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(
          `<link rel="alternate" hreflang="${lang}" href="./${lang}.html">`,
          { html: true },
        );
      },
    })
    .transform(html);
  const name = lang === "en" ? "index.html" : `${lang}.html`;
  await Bun.write(`dist/${name}`, page);
}
```

## 账本,以及局限

作为产品负责人,我关心的不是优雅,是账本:笔记本上完整构建不到一秒;`dist/`
完全静态、相对路径,可部署到任何托管商的任意基础路径下;CI 只装一个
Bun。最重要的是,这套流水线五分钟就能向新人讲清楚——拿 2019 年的 Webpack
配置试试看。

也要诚实:Bun 不是 Astro 或
Eleventy,没有集合、短代码、主题生态,站点地图、订阅源、社交元数据都得自己手写。这正是我签下的合同:二十年来我接手过太多没人完全弄懂的系统,我宁愿要一个做得少、但我全懂的工具。

在我定居的成都,比喻信手拈来:这是满厨房机器人和一把好刀之间的区别。刀不能包打天下,但它永远不会在周五晚上罢工。
