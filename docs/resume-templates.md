# 简历模板

上传 PDF 后默认在原文件上修改：对照原文和 JD 核对建议，只有勾选采用的内容才进入新稿；保留照片、版式和未修改的内容。保存为独立文件，邮件使用核对过的同一份文件。

「重新排版」是可选功能，展开后才显示模板。原位编辑放不下时会提示缩短，不会自动套模板。跨页、跨栏、旋转或不能单独移除的组合文字暂不支持原位替换；扫描件需先 OCR。DOCX／TXT 可核对正文后主动选择 PDF 模板。

原位编辑在浏览器内通过 PDFium 移除目标文字对象，再写入确认后的文字；不会用白块遮住旧文字。修改段落使用内置中文字体，局部粗体或混合字体可能变化；未修改的文字、图片和图形继续使用原对象。PDFium 的许可随本机静态资源一并提供。

新增四套是参考以下样张、针对纯文本简历独立实现的 PDF 排版适配，并非直接运行原项目或 Typst 源码：

| 模板 | 参考来源 | 本项目排版 |
| --- | --- | --- |
| Meowth | [Reactive Resume](https://rxresu.me/templates/pdf/meowth.pdf)（Amruth Pillai，项目 MIT） | 左对齐抬头、砖红分节、经历分栏、日期靠右 |
| Brilliant | [Brilliant-CV](https://typst.app/universe/package/brilliant-cv/)（Yunan Wang，Apache-2.0） | 大字号抬头、蓝色标题与联系方式、公司和职位分层 |
| Persian | [Reactive Resume](https://rxresu.me/templates/pdf/persian.pdf)（Amruth Pillai，项目 MIT） | 黑白居中抬头、横线分节、日期靠右 |
| 中文 Typst | [Chinese Resume in Typst](https://github.com/OrangeX4/Chinese-Resume-in-Typst)（OrangeX4） | 居中抬头、蓝色分节、日期置于左列 |

未复制上游模板源码、字体、图标或人物照片。字体沿用项目内的 Noto Sans SC，许可见 `public/fonts/OFL.txt`。不生成照片、公司标志、技能评级，也不插入隐藏的 ATS 关键词。

在教育、工作、实习、项目等已识别章节中，明确的日期范围会与相邻的经历标题对齐；显式分隔的公司和职位可分栏。无法识别时按原文换行。正文保留为可提取文字，长内容自动分页。

模板缩略图由实际 PDF 生成，使用 `examples/resume-templates.txt` 中的演示资料。调整排版后运行 `npx tsx scripts/render-resume-template-previews.ts` 更新缩略图；用于核对的完整 PDF 和图片输出到忽略目录 `dist/resume-templates/`。
