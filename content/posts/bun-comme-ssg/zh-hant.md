---
title: 用 Bun 當靜態網站產生器
date: 2026-01-15
summary: 在金融軟體業做了二十年建置流程,我學會了不信任相依套件。這個網站由 Bun.build、HTMLRewriter 和一個小小的預先算繪迴圈產生,僅此而已。
tags: [bun, ssg]
---

在金融軟體業待了二十年,人會留下職業病:先數相依套件,再數功能。我接手過太多建置流程,一半的套件早沒人維護,也沒人記得當初為何加入。重做線上履歷時,規則比第一行程式碼更早寫下:建置零相依,不用
Vite、不用 Webpack,不靠陌生人的善意續命的外掛。

## 三項能力,一項不多

Bun 讓這條規則負擔得起,三項能力足以產出整個網站。

第一是
`Bun.build`,內建的打包工具。一個入口、一個輸出資料夾、壓縮,寥寥幾個參數,TypeScript
和 CSS
編譯完成,檔名帶上快取指紋。沒有要馴服的設定,沒有要在週五深夜除錯的外掛圖。

第二是 `HTMLRewriter`,由 Cloudflare Workers 推廣、Bun 原生實作的 HTML 轉換
API。SEO 標籤、`alternate`/`hreflang`
連結、語言協商腳本,都由它在建置期注入文件頭部,絕不留到執行期。

第三最平凡,也最關鍵:Bun 直接執行 TypeScript。算繪函式是純函式,回傳字串,不碰
DOM,於是每種語言呼叫一次,用 `Bun.write`
寫入磁碟。七種語言,八個頁面,英文既作根頁面,也單獨發佈。

預先算繪的核心就是這段迴圈:

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

## 帳本,以及限制

身為產品負責人,我關心的不是優雅,是帳本:筆電上完整建置不到一秒;`dist/`
完全靜態、相對路徑,可部署到 GitHub Pages 或任何網路託管服務的任意基礎路徑下;CI
只裝一個 Bun。最重要的是,這套流程五分鐘就能向剛接觸專案的新人講清楚——拿 2019
年的 Webpack 設定檔試試看。

也要誠實:Bun 不是 Astro 或
Eleventy,沒有集合、短代碼、主題生態,網站地圖、訂閱源、社群中繼資料都得自己手寫。這正是我簽下的合約:二十年來我接手過太多沒人完全弄懂的系統,我寧可要一個做得少、但我全懂的工具。

在我定居的成都,比喻信手拈來:這是滿廚房機器人和一把好刀之間的差別。刀不能包打天下,但它永遠不會在週五晚上罷工。
