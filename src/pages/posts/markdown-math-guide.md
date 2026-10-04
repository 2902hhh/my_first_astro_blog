---
layout: ../../layouts/MarkdownPostLayout.astro
title: 'Markdown 数学公式常用写法：从上下标到矩阵与积分'
pubDate: 2026-10-04
description: '整理 Markdown 数学公式的常用语法，包含源码与显示效果：上下标、分式、希腊字母、集合、矩阵、分段函数、求和、微积分，以及概率和信号处理中的常见公式。'
author: 'ChatGPT'
tags:
  - Markdown
  - 数学
  - KaTeX
category: 'tech'
pinned: false
---

在 Markdown 中写数学公式，通常是在公式区域里使用 LaTeX 风格的命令。记住几个基础规则，就可以把学习笔记里的分式、矩阵、求和与积分写清楚。

本文按“源码 + 显示效果”整理常用写法，可直接复制到本地写作应用的 Markdown 模式中使用。本博客使用 remark-math 识别数学语法，再通过 KaTeX 渲染。数学公式属于 Markdown 扩展，其他编辑器或网站需要提供相应支持，才能得到同样的显示效果。[remark-math 官方说明](https://github.com/remarkjs/remark-math/tree/main/packages/remark-math)

## 1. 行内公式与独立公式

### 行内公式

用一对单美元符号把公式包起来，适合嵌入句子。

~~~markdown
若 $a^2 + b^2 = c^2$，则这三个边长满足勾股定理的等式。
~~~

显示效果：

若 $a^2 + b^2 = c^2$，则这三个边长满足勾股定理的等式。

### 独立公式

用两对美元符号包围公式，适合比较长的表达式。建议让起止符号各占一行，并在整个公式块前后留出空行。

~~~markdown
$$
a^2 + b^2 = c^2
$$
~~~

显示效果：

$$
a^2 + b^2 = c^2
$$

本文的源码框用于展示写法；真正插入公式时，复制框内的内容即可，不要把外层代码围栏也复制进去。

## 2. 上标、下标与分组

上标使用 `^`，下标使用 `_`。上下标包含多个字符时，用花括号把它们组成一组。

| 含义 | Markdown 写法 | 显示效果 |
| --- | --- | --- |
| 平方 | `$x^2$` | $x^2$ |
| 多字符上标 | `$x^{n+1}$` | $x^{n+1}$ |
| 单字符下标 | `$a_i$` | $a_i$ |
| 多字符下标 | `$a_{ij}$` | $a_{ij}$ |
| 同时使用上下标 | `$x_i^{(k)}$` | $x_i^{(k)}$ |
| 转置 | `$A^{\mathsf{T}}$` | $A^{\mathsf{T}}$ |

例如，`$x^12$` 只会把紧跟 `^` 的第一个字符放到上标中。要写十二次方，应使用 `$x^{12}$`。

## 3. 分式、根号与括号

| 含义 | Markdown 写法 | 显示效果 |
| --- | --- | --- |
| 分式 | `$\frac{a+b}{c+d}$` | $\frac{a+b}{c+d}$ |
| 平方根 | `$\sqrt{x}$` | $\sqrt{x}$ |
| 三次根 | `$\sqrt[3]{x}$` | $\sqrt[3]{x}$ |
| 绝对值 | `$\lvert x \rvert$` | $\lvert x \rvert$ |
| 向量范数 | `$\lVert \mathbf{x} \rVert_2$` | $\lVert \mathbf{x} \rVert_2$ |
| 集合花括号 | `$\{1,2,3\}$` | $\{1,2,3\}$ |

花括号通常用于分组，不会直接显示；要显示它们，需要写成 `\{` 和 `\}`。

分式或矩阵比较高时，用 `\left` 和 `\right` 让括号随内容调整大小：

~~~markdown
$$
\left(\frac{a+b}{c+d}\right)^2
$$
~~~

$$
\left(\frac{a+b}{c+d}\right)^2
$$

`\left` 和 `\right` 要成对使用。如果只需要一侧括号，另一侧可以用 `.` 表示不显示的定界符，例如 `\left. ... \right|`。

## 4. 希腊字母与常见运算符

### 希腊字母

| Markdown 写法 | 显示效果 | Markdown 写法 | 显示效果 |
| --- | --- | --- | --- |
| `$\alpha$` | $\alpha$ | `$\beta$` | $\beta$ |
| `$\gamma$` | $\gamma$ | `$\delta$` | $\delta$ |
| `$\epsilon$` | $\epsilon$ | `$\varepsilon$` | $\varepsilon$ |
| `$\theta$` | $\theta$ | `$\lambda$` | $\lambda$ |
| `$\mu$` | $\mu$ | `$\sigma$` | $\sigma$ |
| `$\pi$` | $\pi$ | `$\omega$` | $\omega$ |
| `$\Delta$` | $\Delta$ | `$\Omega$` | $\Omega$ |

命令区分大小写。例如 `\delta` 是小写 $\delta$，`\Delta` 是大写 $\Delta$。

### 运算与比较

| 含义 | Markdown 写法 | 显示效果 |
| --- | --- | --- |
| 乘号、点乘符号 | `$a \times b,\ a \cdot b$` | $a \times b,\ a \cdot b$ |
| 除号 | `$a \div b$` | $a \div b$ |
| 正负号 | `$x = \pm 1$` | $x = \pm 1$ |
| 不等于 | `$a \ne b$` | $a \ne b$ |
| 小于等于、大于等于 | `$a \le b,\ c \ge d$` | $a \le b,\ c \ge d$ |
| 约等于 | `$\pi \approx 3.14159$` | $\pi \approx 3.14159$ |
| 正比于 | `$y \propto x$` | $y \propto x$ |
| 无穷大 | `$x \to \infty$` | $x \to \infty$ |

## 5. 集合与逻辑符号

| 含义 | Markdown 写法 | 显示效果 |
| --- | --- | --- |
| 常见数集 | `$\mathbb{N},\mathbb{Z},\mathbb{Q},\mathbb{R},\mathbb{C}$` | $\mathbb{N},\mathbb{Z},\mathbb{Q},\mathbb{R},\mathbb{C}$ |
| 属于、不属于 | `$x \in A,\ y \notin A$` | $x \in A,\ y \notin A$ |
| 子集 | `$A \subseteq B$` | $A \subseteq B$ |
| 并集、交集 | `$A \cup B,\ A \cap B$` | $A \cup B,\ A \cap B$ |
| 空集 | `$\varnothing$` | $\varnothing$ |
| 任意、存在 | `$\forall x,\ \exists y$` | $\forall x,\ \exists y$ |
| 推出、等价 | `$A \Rightarrow B,\ A \Leftrightarrow B$` | $A \Rightarrow B,\ A \Leftrightarrow B$ |

集合描述中，“使得”可以用 `\mid`：

~~~markdown
$$
A = \{x \in \mathbb{R} \mid x \ge 0\}
$$
~~~

$$
A = \{x \in \mathbb{R} \mid x \ge 0\}
$$

在 Markdown 表格里，用 `\mid`、`\lvert` 和 `\rvert` 比直接输入竖线更方便，可以避免竖线被识别成表格的列分隔符。

## 6. 函数、字体与文字说明

正弦、余弦、对数等函数名建议使用对应命令，让名称按函数排版。

| 含义 | Markdown 写法 | 显示效果 |
| --- | --- | --- |
| 三角函数 | `$\sin x,\ \cos x,\ \tan x$` | $\sin x,\ \cos x,\ \tan x$ |
| 自然对数 | `$\ln x$` | $\ln x$ |
| 带底数的对数 | `$\log_2 x$` | $\log_2 x$ |
| 指数函数 | `$\exp(x)$` | $\exp(x)$ |
| 最大值、最小值 | `$\max(a,b),\ \min(a,b)$` | $\max(a,b),\ \min(a,b)$ |
| 粗体向量 | `$\mathbf{x}$` | $\mathbf{x}$ |
| 向量箭头 | `$\vec{v}$` | $\vec{v}$ |
| 估计值 | `$\hat{\theta}$` | $\hat{\theta}$ |
| 均值标记 | `$\bar{x}$` | $\bar{x}$ |
| 自定义算子 | `$\operatorname{rank}(A)$` | $\operatorname{rank}(A)$ |

普通文字使用 `\text{...}`，单位可以用 `\mathrm{...}`。`\,` 表示一个小间距：

~~~markdown
$$
v = 3\,\mathrm{m/s}
\qquad
\text{其中 } v \text{ 表示速度}
$$
~~~

$$
v = 3\,\mathrm{m/s}
\qquad
\text{其中 } v \text{ 表示速度}
$$

常用间距从小到大可使用 `\,`、`\;`、`\quad`、`\qquad`。公式中连续输入普通空格，通常不会产生相应的排版间距。

## 7. 求和、连乘与组合数

求和用 `\sum`，连乘用 `\prod`；上下界仍然使用下标和上标。

~~~markdown
$$
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}
\qquad
\prod_{k=1}^{n} k = n!
$$
~~~

$$
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}
\qquad
\prod_{k=1}^{n} k = n!
$$

组合数可以使用 `\binom{n}{k}`：

~~~markdown
$$
\binom{n}{k} = \frac{n!}{k!(n-k)!},
\qquad 0 \le k \le n
$$
~~~

$$
\binom{n}{k} = \frac{n!}{k!(n-k)!},
\qquad 0 \le k \le n
$$

上式中的 $n$ 和 $k$ 为整数。行内公式的上下界可能显示在符号右侧；独立公式通常使用更展开的排版。需要在行内使用展示式样时，可以写 `$\displaystyle\sum_{k=1}^{n} k$`，注意这会增加所在行的高度。

## 8. 极限、导数与积分

### 极限

~~~markdown
$$
\lim_{x \to 0} \frac{\sin x}{x} = 1
$$
~~~

$$
\lim_{x \to 0} \frac{\sin x}{x} = 1
$$

### 导数与偏导数

~~~markdown
$$
\frac{\mathrm{d}}{\mathrm{d}x}x^2 = 2x
\qquad
\frac{\partial}{\partial x}(x^2+y^2) = 2x
$$
~~~

$$
\frac{\mathrm{d}}{\mathrm{d}x}x^2 = 2x
\qquad
\frac{\partial}{\partial x}(x^2+y^2) = 2x
$$

普通导数的微分符号可写成 `\mathrm{d}`；偏导符号使用 `\partial`。

### 不定积分与定积分

~~~markdown
$$
\int x^2\,\mathrm{d}x = \frac{x^3}{3}+C
\qquad
\int_0^1 x^2\,\mathrm{d}x = \frac{1}{3}
$$
~~~

$$
\int x^2\,\mathrm{d}x = \frac{x^3}{3}+C
\qquad
\int_0^1 x^2\,\mathrm{d}x = \frac{1}{3}
$$

这里 $C$ 是积分常数。二重积分、三重积分和闭合路径积分分别可以使用 `\iint`、`\iiint`、`\oint`。

## 9. 矩阵与向量

矩阵环境里，`&` 分隔列，`\\` 换行。环境名决定矩阵外侧的括号。

| 环境 | 外侧样式 |
| --- | --- |
| `matrix` | 无括号 |
| `pmatrix` | 圆括号 |
| `bmatrix` | 方括号 |
| `vmatrix` | 单竖线，常用于行列式 |

下面是矩阵与列向量相乘的写法：

~~~markdown
$$
\begin{bmatrix}
2 & 1 \\
0 & 3
\end{bmatrix}
\begin{pmatrix}
x \\
y
\end{pmatrix}
=
\begin{pmatrix}
2x+y \\
3y
\end{pmatrix}
$$
~~~

$$
\begin{bmatrix}
2 & 1 \\
0 & 3
\end{bmatrix}
\begin{pmatrix}
x \\
y
\end{pmatrix}
=
\begin{pmatrix}
2x+y \\
3y
\end{pmatrix}
$$

一般矩阵中常用 `\cdots` 表示横向省略，`\vdots` 表示纵向省略，`\ddots` 表示对角方向省略。

## 10. 分段函数与多行对齐

### 分段函数

使用 `cases` 环境。每行用 `&` 分开表达式和条件，用 `\\` 换行。

~~~markdown
$$
\lvert x\rvert =
\begin{cases}
x, & x \ge 0 \\
-x, & x < 0
\end{cases}
$$
~~~

$$
\lvert x\rvert =
\begin{cases}
x, & x \ge 0 \\
-x, & x < 0
\end{cases}
$$

### 多行公式

推导过程可以使用 `aligned` 环境。把 `&` 放在等号前，就可以对齐等号。

~~~markdown
$$
\begin{aligned}
(a+b)^2
&= (a+b)(a+b) \\
&= a^2+ab+ba+b^2 \\
&= a^2+2ab+b^2
\end{aligned}
$$
~~~

$$
\begin{aligned}
(a+b)^2
&= (a+b)(a+b) \\
&= a^2+ab+ba+b^2 \\
&= a^2+2ab+b^2
\end{aligned}
$$

这里按普通实数的运算展开，因此 $ab=ba$。矩阵乘法一般不能直接使用这一步。

## 11. 概率与统计的常用写法

条件概率中的竖线可以使用 `\mid`。贝叶斯公式的一种写法如下，其中 $P(B)>0$：

~~~markdown
$$
P(A \mid B) =
\frac{P(B \mid A)P(A)}{P(B)}
$$
~~~

$$
P(A \mid B) =
\frac{P(B \mid A)P(A)}{P(B)}
$$

样本均值和样本方差也经常用到求和、下标与分式：

~~~markdown
$$
\bar{x} = \frac{1}{n}\sum_{i=1}^{n}x_i
\qquad
s^2 = \frac{1}{n-1}\sum_{i=1}^{n}(x_i-\bar{x})^2
$$
~~~

$$
\bar{x} = \frac{1}{n}\sum_{i=1}^{n}x_i
\qquad
s^2 = \frac{1}{n-1}\sum_{i=1}^{n}(x_i-\bar{x})^2
$$

第二个式子采用分母为 $n-1$ 的样本方差定义，要求 $n>1$。期望可写成 `$\mathbb{E}[X]$`，方差可写成 `$\operatorname{Var}(X)$`。

## 12. 复数与信号处理示例

在通信与信号处理的笔记里，常用 $j$ 表示虚数单位，即 $j^2=-1$。欧拉公式把复指数与三角函数联系起来：

~~~markdown
$$
e^{j\theta} = \cos\theta+j\sin\theta
$$
~~~

$$
e^{j\theta} = \cos\theta+j\sin\theta
$$

离散傅里叶变换（DFT）可以写成：

~~~markdown
$$
X[k] = \sum_{n=0}^{N-1}
x[n]e^{-j\frac{2\pi kn}{N}},
\qquad k=0,1,\ldots,N-1
$$
~~~

$$
X[k] = \sum_{n=0}^{N-1}
x[n]e^{-j\frac{2\pi kn}{N}},
\qquad k=0,1,\ldots,N-1
$$

这里 $N$ 是序列长度，$x[n]$ 是时域序列，$X[k]$ 是变换结果。这个例子同时用到了求和上下界、分式、多字符指数和省略号。

## 13. 写公式时容易遇到的问题

1. **公式原样显示**：先确认所在编辑器或网站支持数学公式扩展；正文里的公式不要放在普通代码框或行内代码中。
2. **只有一个字符进入上下标**：检查是否遗漏花括号。`a_{n+1}` 和 `a_n+1` 的含义不同。
3. **矩阵没有换行**：环境内部换行用两个反斜杠 `\\`；`\frac` 等普通命令只使用一个反斜杠。
4. **括号报错**：检查 `\left`、`\right`，以及 `\begin{...}`、`\end{...}` 是否匹配。
5. **函数名像几个变量**：用 `\sin`、`\log` 等函数命令；公式里的说明文字用 `\text{...}`。
6. **表格被竖线拆开**：优先使用 `\mid`、`\lvert`、`\rvert` 表达相应符号。

数学渲染器支持的命令范围可能不同。本文使用的是 KaTeX 的常见命令；遇到较少见的命令，可以查阅 [KaTeX 支持的函数](https://katex.org/docs/supported.html)，再在本地实时预览中确认效果。
