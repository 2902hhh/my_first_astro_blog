# 丁焕的个人博客

基于 Astro 6 的静态博客，使用 Markdown 写作，支持技术与生活分类、置顶、分页、标签和 KaTeX 公式。

## 本地运行

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run dev
```

## 检查与构建

```sh
npm run test:unit  # 分类、排序、分页边界及标签规则
npm test          # 构建所有页面，再验证列表、链接、文章、图片和公式
npm run build
npm run preview
```

## 写作与维护

- 文章位于 `src/pages/posts/`，可参考 `src/_post-template.md`。
- 图片放入 `public/images/`。现有文章文件名决定 URL，修改文件名会改变文章地址。
- 分类页每页 4 篇，置顶优先，其余按日期倒序；未设置分类的文章归入技术。
- 标签页按日期倒序，不采用置顶规则。
- `src/lib/posts.ts` 集中处理分类、标签和分页；`PostList.astro` 与 `Pagination.astro` 负责共用展示。

## Aurora 视觉约定

`src/styles/global.css` 集中定义颜色、间距、宽度和字体。首页使用蓝紫青色极光渐变，仅背景缓慢移动；生活分类偏紫粉；文章页减弱背景，正文宽度 720px。保留系统中文字体，不加载远程字体或动画库。

代码块、公式和表格在各自区域横向滚动，图片限制在正文宽度内。导航、标签与分页支持键盘焦点；系统开启减少动态效果时停止动画。
