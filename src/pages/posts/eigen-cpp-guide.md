---
layout: ../../layouts/MarkdownPostLayout.astro
title: 'Eigen 常用类型与函数速查：C++ 矩阵、向量和线性代数'
pubDate: 2026-11-02
description: '整理 Eigen C++ 库的常用类型与用法：矩阵和向量声明、初始化、索引、分块、逐元素运算、线性方程求解，以及 Map、Ref 和表达式求值中的常见问题。'
author: 'ChatGPT'
tags:
  - Eigen
  - C++
  - 线性代数
category: 'tech'
pinned: false
---

Eigen 是用于矩阵、向量和线性代数计算的 C++ 库。这篇文章整理它的常用类型、成员函数与使用方式，适合写数值计算、算法和工程项目时查阅。

示例采用 C++17，使用 Eigen 3.4.0 验证。文中的官方文档链接部分指向开发版文档；本文只使用已在 3.4.0 中验证的写法。

## 1. 头文件与第一个程序

常用头文件：

| 头文件 | 用途 |
| --- | --- |
| `Eigen/Core` | 基本矩阵、向量和数组 |
| `Eigen/Dense` | 常用稠密矩阵运算与分解 |
| `Eigen/Geometry` | 旋转、四元数和空间变换 |
| `Eigen/Sparse` | 稀疏矩阵及相关求解器 |

Eigen 的常用功能通过头文件提供。手动配置时，将**包含 `Eigen` 文件夹的目录**加入编译器的头文件搜索路径。

下面的完整程序求解 $Ax=b$：

~~~cpp
#include <Eigen/Dense>
#include <iostream>

int main() {
    Eigen::Matrix2d A;
    A << 4.0, 1.0,
         1.0, 3.0;
    Eigen::Vector2d b(1.0, 2.0);

    Eigen::Vector2d x = A.colPivHouseholderQr().solve(b);
    std::cout << "x:\n" << x << '\n';
    std::cout << "residual: " << (A * x - b).norm() << '\n';
}
~~~

结果应接近 $x=(1/11,\ 7/11)^{\mathsf{T}}$，残差接近零。浮点运算的最后几位可能随编译环境变化。

使用 GCC 或 Clang 时，可按实际路径替换下面的 `eigen-3.4.0`：

~~~sh
g++ -std=c++17 -O2 -I"path/to/eigen-3.4.0" main.cpp -o eigen_demo
~~~

如果 Eigen 已安装并提供 CMake 配置，可以写：

~~~cmake
cmake_minimum_required(VERSION 3.16)
project(eigen_demo LANGUAGES CXX)
find_package(Eigen3 3.4 REQUIRED NO_MODULE)
add_executable(eigen_demo main.cpp)
target_compile_features(eigen_demo PRIVATE cxx_std_17)
target_link_libraries(eigen_demo PRIVATE Eigen3::Eigen)
~~~

这里的 `Eigen3::Eigen` 是 CMake 目标，用于传递包含目录等使用要求。只有下载的头文件时，前面的 `-I` 方式更直接。[官方 CMake 指南](https://libeigen.gitlab.io/eigen/docs-nightly/TopicCMakeGuide.html)

除明确给出完整程序的代码外，下文片段可分别放入 `main()` 中运行，并按需要包含上表中的头文件。输出示例还需 `<iostream>`，稀疏矩阵示例还需 `<vector>`。

## 2. 常用矩阵、向量和数组类型

Eigen 的列向量可以看作只有一列的矩阵，行向量则只有一行。

| 类型 | 含义 |
| --- | --- |
| `Eigen::Matrix2d` | $2\times2$，元素为 `double` |
| `Eigen::Matrix3f` | $3\times3$，元素为 `float` |
| `Eigen::Matrix4d` | $4\times4$，元素为 `double` |
| `Eigen::MatrixXd` | 动态行列数，元素为 `double` |
| `Eigen::MatrixXi` | 动态行列数，元素为 `int` |
| `Eigen::Vector3d` | 三维列向量，元素为 `double` |
| `Eigen::VectorXd` | 动态长度列向量，元素为 `double` |
| `Eigen::RowVectorXd` | 动态长度行向量，元素为 `double` |
| `Eigen::ArrayXd` | 动态长度数组，方便逐元素计算 |
| `Eigen::ArrayXXd` | 动态二维数组 |
| `Eigen::Index` | Eigen 尺寸和索引常用的整数类型 |

常见命名中，`d` 表示 `double`，`f` 表示 `float`，`i` 表示 `int`，`X` 表示该维度在运行时确定。

类型的基础形式是：

~~~cpp
Eigen::Matrix<double, 3, 3> R;  // 等同于 Matrix3d
Eigen::Matrix<double, 3, 1> v;  // 等同于 Vector3d
Eigen::Matrix<double, 3, Eigen::Dynamic> points(3, 10);
Eigen::MatrixXd data(5, 8);
Eigen::VectorXd samples(100);
~~~

小而固定的尺寸可以直接写在类型里；样本数量随输入变化时，使用动态尺寸。`MatrixXd` 的默认构造对象是 $0\times0$，使用前要分配尺寸。

**分配尺寸不等于初始化数值。**普通默认构造或仅给出尺寸的构造，不能当作已经清零。需要零值时显式使用 `Zero()` 或 `setZero()`。[Matrix 类型说明](https://libeigen.gitlab.io/eigen/docs-nightly/group__TutorialMatrixClass.html)

## 3. 初始化与尺寸调整

| 写法 | 用途 |
| --- | --- |
| `Eigen::Matrix3d::Zero()` | 固定尺寸零矩阵 |
| `Eigen::MatrixXd::Zero(r, c)` | 动态尺寸零矩阵 |
| `Eigen::Matrix3d::Identity()` | 单位矩阵 |
| `Eigen::VectorXd::Ones(n)` | 元素全为一的向量 |
| `Eigen::MatrixXd::Constant(r, c, value)` | 全部元素取同一数值 |
| `m.setZero()`、`m.setIdentity()` | 修改已有对象 |
| `v.setConstant(value)` | 将已有对象设为常数 |
| `Eigen::VectorXd::LinSpaced(n, low, high)` | 含两端点的等间距向量 |

逗号初始化器按视觉上的“先行后列”填写，与底层的列主序存储是两回事：

~~~cpp
Eigen::MatrixXd A(2, 3);
A << 1, 2, 3,
     4, 5, 6;
Eigen::Matrix3d I = Eigen::Matrix3d::Identity();
Eigen::VectorXd t = Eigen::VectorXd::LinSpaced(5, 0.0, 1.0);
std::cout << t.transpose() << '\n';  // 0 0.25 0.5 0.75 1

Eigen::MatrixXd zeros = Eigen::MatrixXd::Zero(2, 3);
Eigen::VectorXd v = Eigen::VectorXd::Ones(3);
v.conservativeResize(5);
v.tail(2).setZero();  // 新增部分需要自己初始化
~~~

`resize()` 不保证保留原有数值；需要保留已有部分时使用 `conservativeResize()`。固定尺寸类型不能随意改成其他尺寸。逗号初始化时，元素数量应与对象尺寸一致。[初始化说明](https://libeigen.gitlab.io/eigen/docs-nightly/group__TutorialAdvancedInitialization.html)

## 4. 访问元素、行列与分块

索引从 **0** 开始。

| 写法 | 含义 |
| --- | --- |
| `A(i, j)` | 第 `i` 行、第 `j` 列 |
| `v(i)`、`v[i]` | 向量的第 `i` 个元素 |
| `A.rows()`、`A.cols()` | 行数、列数 |
| `A.size()` | 元素总数 |
| `A.row(i)`、`A.col(j)` | 一行、一列 |
| `A.block(i, j, r, c)` | 从 `(i,j)` 开始的 `r×c` 子块 |
| `A.block<2, 2>(i, j)` | 尺寸在编译期确定的子块 |
| `v.head(n)`、`v.tail(n)` | 向量前、后 `n` 项 |
| `v.segment(start, n)` | 从 `start` 开始的 `n` 项 |
| `A.diagonal()` | 主对角线视图 |

~~~cpp
Eigen::Matrix3d A;
A << 1, 2, 3,
     4, 5, 6,
     7, 8, 9;

Eigen::Matrix2d saved = A.block<2, 2>(0, 0);  // 独立副本
auto view = A.block<2, 2>(0, 0);             // 引用原矩阵的视图
view(0, 0) = 99;
std::cout << saved(0, 0) << ' ' << A(0, 0) << '\n';  // 1 99
A.col(2).setZero();
~~~

分块和行列访问通常返回视图，给它们赋值会修改原矩阵。需要独立保存时，明确使用矩阵类型接收。视图有效期间，原对象必须存在，且不要对原对象做导致存储失效的尺寸调整。[分块操作说明](https://libeigen.gitlab.io/eigen/docs-nightly/group__TutorialBlockOperations.html)

## 5. 矩阵乘法与逐元素运算

这是最需要区分的一组操作：

| 写法 | 含义 |
| --- | --- |
| `A + B`、`A - B` | 相同尺寸矩阵的加减 |
| `A * B` | 矩阵乘法，要求 `A.cols() == B.rows()` |
| `A * s`、`A / s` | 乘、除标量 |
| `A.cwiseProduct(B)` | 相同位置的元素相乘 |
| `A.cwiseQuotient(B)` | 相同位置的元素相除 |
| `A.array() * B.array()` | 逐元素相乘 |
| `A.array() + s` | 每个元素都加 `s` |
| `A.array().square()` | 每个元素平方 |
| `A.array().sqrt()`、`.exp()`、`.log()` | 对各元素应用对应函数 |
| `array.matrix()` | 切换回矩阵运算语义 |

~~~cpp
Eigen::Matrix2d A, B;
A << 1, 2,
     3, 4;
B << 2, 0,
     1, 2;
Eigen::Matrix2d product = A * B;
Eigen::Matrix2d elementwise = A.cwiseProduct(B);
Eigen::Matrix2d shifted = (A.array() + 10.0).matrix();
std::cout << product << "\n---\n" << elementwise << '\n';
~~~

矩阵乘积是 $\begin{bmatrix}4&4\\10&8\end{bmatrix}$，逐元素乘积是 $\begin{bmatrix}2&0\\3&8\end{bmatrix}$。

`.array()` 和 `.matrix()` 用于切换操作语义，本身不意味着一定复制全部数据。逐元素开方、对数、除法等仍要满足数值定义域要求。[矩阵运算](https://libeigen.gitlab.io/eigen/docs-nightly/group__TutorialMatrixArithmetic.html)、[Array 与逐元素运算](https://libeigen.gitlab.io/eigen/docs-nightly/group__TutorialArrayClass.html)

## 6. 向量：点积、叉积和模长

~~~cpp
Eigen::Vector3d u(1.0, 0.0, 0.0);
Eigen::Vector3d v(0.0, 2.0, 0.0);
double dot = u.dot(v);            // 0
Eigen::Vector3d cross = u.cross(v);  // (0, 0, 2)
double length = v.norm();         // 2
double length2 = v.squaredNorm(); // 4
Eigen::Vector3d direction = v.normalized();
v.normalize();                   // 原地归一化
std::cout << dot << ' ' << length << ' ' << length2 << '\n';
std::cout << cross.transpose() << '\n';
~~~

`normalized()` 返回归一化结果，`normalize()` 修改原对象。只有模长足够大时，归一化才适合作为方向计算；零向量没有确定的方向。`cross()` 的常见用法是三维向量叉积，需要包含几何模块。

对矩阵调用 `norm()` 得到的是 Frobenius 范数，即全部元素平方和的平方根；不要直接把它理解为矩阵的谱范数。

## 7. 转置、共轭与聚合统计

| 写法 | 用途 |
| --- | --- |
| `A.transpose()` | 转置 |
| `A.conjugate()` | 元素取共轭 |
| `A.adjoint()` | 共轭转置 |
| `A.sum()`、`A.mean()` | 所有元素的和、均值 |
| `A.minCoeff()`、`A.maxCoeff()` | 最小、最大元素 |
| `A.trace()` | 方阵对角线元素之和 |
| `A.determinant()` | 方阵行列式 |
| `A.colwise().sum()` | 各列求和，得到行向量 |
| `A.rowwise().sum()` | 各行求和，得到列向量 |

~~~cpp
Eigen::Matrix2d A;
A << 2, 4,
     6, 8;
Eigen::Index row = 0, col = 0;
double maximum = A.maxCoeff(&row, &col);
Eigen::RowVector2d columnSums = A.colwise().sum();
Eigen::Vector2d rowSums = A.rowwise().sum();
std::cout << A.mean() << ' ' << maximum << '\n';  // 5 8
std::cout << row << ' ' << col << '\n';           // 1 1
std::cout << columnSums << '\n';                  // 8 12
~~~

求最大值或最小值前，确保对象非空。`Eigen::Index` 适合接收这里的行列位置。[聚合与按行列运算](https://libeigen.gitlab.io/eigen/docs-nightly/group__TutorialReductionsVisitorsBroadcasting.html)

## 8. 类型转换与近似比较

~~~cpp
Eigen::Matrix2i integerMatrix;
integerMatrix << 1, 2, 3, 4;
Eigen::Matrix2d A = integerMatrix.cast<double>();
Eigen::Matrix2d B = A;
B(0, 0) += 1e-12;

bool close = A.isApprox(B, 1e-9);
bool finite = A.allFinite();
bool smallResidual = (A - B).norm() < 1e-9;
std::cout << close << ' ' << finite << ' ' << smallResidual << '\n';
~~~

`cast<T>()` 用于显式转换元素类型；从浮点数转为整数会丢失小数部分，超出目标类型可表示范围时也不能视为安全转换。

浮点计算结果通常使用容差比较。`isApprox()` 主要采用相对误差意义下的判断；判断是否接近零时，可以用范数配合明确的绝对阈值。阈值应根据量纲和问题规模选择，不能机械照抄。

## 9. 求解线性方程与最小二乘

求解 $Ax=b$ 时，优先使用分解对象的 `solve()`。直接写 `A.inverse() * b` 会显式构造逆矩阵，通常没有必要。

| 方法 | 常见使用条件 |
| --- | --- |
| `colPivHouseholderQr().solve(b)` | 一般稠密问题，也可用于最小二乘 |
| `partialPivLu().solve(b)` | 可逆方阵 |
| `llt().solve(b)` | 对称正定实矩阵；复数情形为 Hermitian 正定矩阵 |
| `jacobiSvd(...).solve(b)` | 需要 SVD 的最小二乘或秩分析问题 |

例如拟合直线 $y=at+b$：

~~~cpp
Eigen::MatrixXd A(3, 2);
A << 0, 1,
     1, 1,
     2, 1;
Eigen::Vector3d y(1.0, 3.0, 5.0);
Eigen::ColPivHouseholderQR<Eigen::MatrixXd> qr(A);
Eigen::Vector2d coefficients = qr.solve(y);
std::cout << coefficients.transpose() << '\n';  // 2 1
std::cout << (A * coefficients - y).norm() << '\n';
~~~

这里第一列对应 $t$，第二列对应常数项，结果为 $a=2,\ b=1$。

不满秩、病态或带噪声的问题，需要进一步检查秩、残差与解的意义。选定分解后可以保留分解对象，对多个右端项重复调用 `solve()`。不要用行列式是否“恰好等于零”来代替可靠的数值诊断。[线性代数与分解指南](https://libeigen.gitlab.io/eigen/docs-nightly/group__TutorialLinearAlgebra.html)

## 10. 特征值与奇异值

实对称矩阵可使用 `SelfAdjointEigenSolver`：

~~~cpp
Eigen::Matrix2d A;
A << 3, 1,
     1, 3;
Eigen::SelfAdjointEigenSolver<Eigen::Matrix2d> solver(A);
if (solver.info() != Eigen::Success) {
    return 1;
}
Eigen::Vector2d values = solver.eigenvalues();
Eigen::Matrix2d vectors = solver.eigenvectors();
std::cout << values.transpose() << '\n';  // 2 4
std::cout << (A * vectors - vectors * values.asDiagonal()).norm() << '\n';
~~~

特征向量按列排列，对应相同位置的特征值。该求解器要求输入满足对称或 Hermitian 条件；一般实矩阵的特征值可能是复数，应选择相应的通用求解器。

动态矩阵的 SVD 示例：

~~~cpp
Eigen::MatrixXd A(3, 2);
A << 1, 0,
     0, 2,
     0, 0;
Eigen::JacobiSVD<Eigen::MatrixXd> svd(
    A, Eigen::ComputeThinU | Eigen::ComputeThinV);
Eigen::VectorXd singularValues = svd.singularValues();
std::cout << singularValues.transpose() << '\n';  // 2 1
std::cout << (A - svd.matrixU() * singularValues.asDiagonal()
                   * svd.matrixV().transpose()).norm() << '\n';
~~~

上面是实矩阵，重建时使用转置；复矩阵的相应公式使用共轭转置。不要把奇异值和特征值当作同一组数。

## 11. Map：复用已有内存

`Map` 可以把已有数组按 Eigen 对象的方式访问，而不复制这段数据：

~~~cpp
double raw[] = {1, 2, 3, 4, 5, 6};
using RowMatrix = Eigen::Matrix<double, 2, 3, Eigen::RowMajor>;
Eigen::Map<RowMatrix> matrix(raw);
matrix(0, 1) = 20;
std::cout << raw[1] << '\n';  // 20

Eigen::Map<const Eigen::VectorXd> readonly(raw, 6);
std::cout << readonly.sum() << '\n';  // 39
~~~

这里显式使用行主序，让数组中的 `1,2,3` 对应第一行。Eigen 普通矩阵默认采用列主序，映射外部数据时必须核对布局；还要保证指针、元素数量和内存生命周期正确。

`Map<const ...>` 用于只读访问，但它仍然不拥有这块内存。[Map 官方教程](https://libeigen.gitlab.io/eigen/docs-nightly/group__TutorialMapClass.html)

## 12. Ref：把矩阵传给函数

`Ref` 常用于函数接口。下面是可独立编译的完整例子：

~~~cpp
#include <Eigen/Dense>
#include <iostream>

double energy(Eigen::Ref<const Eigen::VectorXd> v) {
    return v.squaredNorm();
}

void addOne(Eigen::Ref<Eigen::MatrixXd> m) {
    m.array() += 1.0;
}

int main() {
    Eigen::VectorXd v(2);
    v << 3, 4;
    Eigen::MatrixXd A = Eigen::MatrixXd::Zero(2, 2);
    addOne(A);
    std::cout << energy(v) << '\n';  // 25
    std::cout << A << '\n';          // 每个元素都为 1
}
~~~

`Ref<const ...>` 表示只读接口，非 `const` 的 `Ref` 可修改兼容的输入。`Ref` 对元素类型、尺寸与内存步长有要求；只读版本遇到某些不兼容表达式时可能产生临时对象，因此不能把它当作对任意输入都“零复制”的保证。[Eigen 函数参数指南](https://libeigen.gitlab.io/eigen/docs-nightly/TopicFunctionTakingEigenTypes.html)

## 13. 表达式、auto 与原地操作

Eigen 会延迟部分表达式的求值。对于想要长期保存的计算结果，明确使用矩阵类型通常更容易理解：

~~~cpp
Eigen::Matrix2d A = Eigen::Matrix2d::Identity();
Eigen::Matrix2d B = Eigen::Matrix2d::Constant(2.0);
Eigen::Matrix2d snapshot = A + B;  // 立即保存结果
auto expression = A + B;          // 保存表达式，引用 A 和 B
A.setZero();
Eigen::Matrix2d later = expression;
std::cout << snapshot(0, 0) << ' ' << later(0, 0) << '\n';  // 3 2

Eigen::Matrix2d evaluated = (A + B).eval();
Eigen::Matrix2d transposed = B.transpose();
B.transposeInPlace();
~~~

`auto` 并不自动意味着“复制计算结果”。避免返回引用局部矩阵的表达式，也不要保存引用已销毁临时对象的表达式；需要独立结果时，可在完整表达式末尾用 `.eval()` 求值。

当赋值两侧访问重叠存储时，还要注意别名问题。例如给重叠子块赋值时，可以先对右侧 `.eval()`。自身转置优先用 `transposeInPlace()`，或 `A = A.transpose().eval()`。只有确认目标与乘法输入不共享数据时，才使用 `noalias()` 优化赋值。

参见官方的 [常见陷阱](https://libeigen.gitlab.io/eigen/docs-nightly/TopicPitfalls.html) 和 [别名问题](https://libeigen.gitlab.io/eigen/docs-nightly/group__TopicAliasing.html)。

## 14. 三维旋转与四元数

~~~cpp
const double pi = std::acos(-1.0);  // 还需包含 <cmath>
Eigen::AngleAxisd rotation(pi / 2.0, Eigen::Vector3d::UnitZ());
Eigen::Quaterniond q(rotation);
Eigen::Matrix3d R = q.toRotationMatrix();
Eigen::Vector3d p(1.0, 0.0, 0.0);
Eigen::Vector3d rotated = R * p;
std::cout << rotated.transpose() << '\n';  // 接近 0 1 0
~~~

`AngleAxisd` 的角度使用弧度，旋转轴应为单位向量。作为旋转使用的四元数也应满足单位长度要求。

直接构造 `Quaterniond(w, x, y, z)` 时，参数顺序是 `w,x,y,z`；而 `q.coeffs()` 返回的内部系数顺序是 `x,y,z,w`。与其他库交换四元数时，先核对顺序和旋转约定。[几何模块教程](https://libeigen.gitlab.io/eigen/docs-nightly/group__TutorialGeometry.html)

## 15. 稀疏矩阵入门

多数元素为零的大矩阵，可以考虑 `SparseMatrix`。常见构建方式是先收集三元组，再统一装配：

~~~cpp
Eigen::SparseMatrix<double> A(3, 3);
std::vector<Eigen::Triplet<double>> entries;
entries.emplace_back(0, 0, 4.0);
entries.emplace_back(1, 1, 5.0);
entries.emplace_back(2, 2, 6.0);
A.setFromTriplets(entries.begin(), entries.end());

Eigen::Vector3d x = Eigen::Vector3d::Ones();
Eigen::Vector3d y = A * x;
std::cout << y.transpose() << '\n';  // 4 5 6
~~~

`Triplet` 的三个参数是行、列、数值；`setFromTriplets()` 默认会把相同位置的条目相加。稀疏矩阵有自己的存储方式和求解器，不能把所有稠密矩阵接口原样套用。[稀疏矩阵教程](https://libeigen.gitlab.io/eigen/docs-nightly/group__TutorialSparse.html)

## 16. 使用前检查这几件事

- **尺寸**：加减和逐元素运算要求形状匹配；矩阵乘法要求内维度一致。
- **初始化**：刚声明的矩阵不能直接当零矩阵使用。
- **数值类型**：需要浮点运算时用 `MatrixXd`、`Matrix3d` 等类型；不同元素类型先明确转换。
- **运算语义**：区分 `A * B` 和 `A.array() * B.array()`。
- **生命周期**：`Map`、分块视图和部分表达式引用已有数据，不能超出其有效期。
- **求解结果**：检查求解器适用条件、状态和残差；不要仅凭程序成功编译就认定数值结果可靠。

进一步查阅时，可以从 [Eigen 官方速查表](https://libeigen.gitlab.io/eigen/docs-nightly/group__QuickRefPage.html) 按函数名定位，再回到对应模块教程核对参数与适用条件。
