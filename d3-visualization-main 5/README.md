
# 必读

## 项目结构

当前网站结构：

```text
index.html                # 网站主结构
static/
  css/
    index.css             # 全局网站样式
  js/
    chart-overview.js
    chart-ranking.js
    chart-trend.js
    chart-discipline.js
    chart-network.js
  data/
    *.csv / *.json
````

目前网站 skeleton 和整体样式已经搭好。

大家主要在各自负责的 JS 文件里开发即可。

---

# 模块对应关系

| 模块     | div id           | JS 文件               |
| ------ | ---------------- | ------------------- |
| 全球概览 - rwx   | overview-chart   | chart-overview.js   |
| 国家合作排名 - jyl | ranking-chart    | chart-ranking.js    |
| 合作趋势 -  ksj  | trend-chart      | chart-trend.js      |
| 学科结构 - gsw  | discipline-chart | chart-discipline.js |
| 合作网络 - zsl  | network-chart    | chart-network.js    |

例如：

```js
const svg = d3.select("#ranking-chart")
```

表示：

```text
这个图会渲染到 ranking-chart 这个区域
```

也就是：

```html
<div id="ranking-chart"></div>
```

所以：

```text
每个人只需要找到自己负责的 js 文件，
然后把 D3 代码写进去即可。
```

不要修改其他人的 div id。

---

# 本地开发方式

推荐流程：

1. pull 最新 main
2. 下载 zip / clone repo 到本地
3. VS Code 打开项目
4. Open with Live Server
5. 本地开发 + 实时预览
6. 没问题后 push

也就是说：

```text
真正开发是在本地完成，
GitHub 主要用于同步和协作。
```

---

# 独立开发规范

每个人：

* 只修改自己负责的 js 文件
* 尽量不要修改 index.html
* 不要随意修改全局 css
* 本地测试没问题后再 push
* merge 前最好先 pull 一下 main

推荐：

```text
overview → chart-overview.js
ranking → chart-ranking.js
trend → chart-trend.js
...
```

这样：

* 大家不会互相影响
* merge conflict 会很少
* 可以并行开发

---

# 数据规范（非常重要）

后期图表之间可能需要联动：

例如：

```text
hover 国家
→ 其他图同步高亮

点击学科
→ ranking/filter 更新

slider 年份
→ 所有图同步变化
```

因此：

```text
不要把数据 hardcode 写死在图里。
```

例如不要：

```js
const china = 120
```

而是：

```js
d.papers
d.country
d.year
```

通过统一字段读取数据。

---

# 推荐统一数据 schema

推荐 csv 格式：

```csv
country,year,papers,discipline
China,2011,120,CS
Poland,2011,40,Physics
```

要求：

* 字段名统一
* 不要一个意思多个名字
* 尽量 lowercase
* 尽量不用空格

例如：

```text
统一用：
papers

不要混用：
paper_count / num_papers / papers
```

---

# 如何保持网站风格统一

当前 template 已经有：

* typography
* spacing
* responsive layout
* color system
* section structure

开发时请尽量：

* 保持 clean academic 风格
* 不要乱用颜色
* 图表尽量居中
* tooltip 风格统一
* 字体大小不要跨度太大

---

# AI 辅助开发（推荐）

如果用 ChatGPT / Claude 帮忙生成 D3 代码，

请告诉 AI：

1. 当前 div id
2. 当前网站结构
3. 当前数据 schema
4. 当前网站风格
5. 使用 D3.js v7
6. 需要 responsive

推荐 prompt：

```text
我正在开发一个 D3 可视化网站。

图表需要渲染到：
<div id="ranking-chart"></div>

当前网站：
- 使用 Bulma CSS
- clean academic visualization 风格
- responsive layout

数据 schema：
country,year,papers,discipline

请生成：
- D3.js v7
- 模块化代码
- responsive
- smooth transition
- tooltip interaction
- 风格和当前网站一致
```

---

```


----
# Academic Project Page Template

> **Update (September 2025)**: This template has been modernized with better design, SEO, and mobile support. For the original version, see the [original-version branch](https://github.com/eliahuhorwitz/Academic-project-page-template/tree/original-version).

A clean, responsive template for academic project pages.


Example project pages built using this template are:
- https://horwitz.ai/probex
- https://vision.huji.ac.il/probegen
- https://horwitz.ai/mother
- https://horwitz.ai/spectral_detuning
- https://vision.huji.ac.il/ladeda
- https://vision.huji.ac.il/dsire
- https://horwitz.ai/podd
- https://dreamix-video-editing.github.io
- https://horwitz.ai/conffusion
- https://horwitz.ai/3d_ads/
- https://vision.huji.ac.il/ssrl_ad
- https://vision.huji.ac.il/deepsim



## Start using the template
To start using the template click on `Use this Template`.

The template uses html for controlling the content and css for controlling the style. 
To edit the websites contents edit the `index.html` file. It contains different HTML "building blocks", use whichever ones you need and comment out the rest.  

**IMPORTANT!** Make sure to replace the `favicon.ico` under `static/images/` with one of your own, otherwise your favicon is going to be a dreambooth image of me.

## What's New

- Modern, clean design with better mobile support
- Improved SEO with proper meta tags and structured data
- Performance improvements (lazy loading, optimized assets)
- More Works dropdown
- Copy button for BibTeX citations
- Better accessibility

## Components

- Teaser video
- Image carousel
- YouTube video embedding
- Video carousel
- PDF poster viewer
- BibTeX citation

## Customization

The HTML file has TODO comments showing what to replace:

- Paper title, authors, institution, conference
- Links (arXiv, GitHub, etc.)
- Abstract and descriptions  
- Videos, images, and PDFs
- Related works in the dropdown
- Meta tags for SEO and social sharing

### Meta Tags
The template includes meta tags for better search engine visibility and social media sharing. These appear in the `<head>` section and help with:
- Google Scholar indexing
- Social media previews (Twitter, Facebook, LinkedIn)
- Search engine optimization

Create a 1200x630px social preview image at `static/images/social_preview.png`.

## Tips

- Compress images with [TinyPNG](https://tinypng.com)
- Use YouTube for large videos (>10MB)  
- Replace the favicon in `static/images/`
- Works with GitHub Pages

## Acknowledgments
Parts of this project page were adopted from the [Nerfies](https://nerfies.github.io/) page.

## Website License
<a rel="license" href="http://creativecommons.org/licenses/by-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution-ShareAlike 4.0 International License</a>.
