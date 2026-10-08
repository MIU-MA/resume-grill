# 简历 PDF 中文字体

`NotoSansSC-Regular.ttf` 来自 Noto CJK 官方仓库的简体中文 TrueType 可变字体，使用 FontTools 4.66.1 将 `wght` 实例化为 `400`，得到静态常规字体：

- 来源：https://github.com/notofonts/noto-cjk/blob/main/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf
- 授权：SIL Open Font License 1.1，完整文本见同目录的 `OFL.txt`。
- 用途：在浏览器中测量简历文字、换行和分页，并按使用的字形子集嵌入导出的 PDF。

字体作为同源静态资源提供，生成 PDF 不把简历发送到第三方字体或转换服务。运行时先用 `fonteditor-core` 生成独立 TrueType 子集，再完整嵌入 PDF，避免 PDF 库直接子集化时丢失可见字形。更新字体时同步来源与许可证，并验证中文、混合英文、分页、文字提取和逐字实际渲染；文字可以提取不代表字形一定能显示。

实例化方法（只用于维护字体资源，项目运行无需 Python）：

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

font = TTFont('NotoSansSC-VF.ttf')
instantiateVariableFont(font, {'wght': 400}, inplace=True)
font.save('NotoSansSC-Regular.ttf')
```
