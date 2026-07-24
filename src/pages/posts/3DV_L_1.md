---
layout: ../../layouts/MarkdownPostLayout.astro
title: '3DV_L_1'
pubDate: 2026-07-22
description: '课程笔记以及作业'
author: '丁焕'
image:
  url: ''
  alt: ''
tags: []
category: 'tech'
pinned: false
---

## 基础知识
第一章主要内容是，PCA，kernel PCA以及它们的应用

### PCA
PCA 的目的就是在点云中寻找数据分布最明显的几个方向

- 点云分布最宽，方差最大的方向
- 除去第一方向，剩余的方差最大的方向
- 点云分布最窄，方差最小的方向

最终得到三个方向和三个特征值
$$
(z_1,\lambda_1),   (z_2,\lambda_2),   (z_3,\lambda_3)
$$
$z_i$表示方向，$\lambda_i$表示点云沿该方向的分散程度

#### 计算方法
对于
$$
 x_i \in \mathbb{R}^3, i = 1,2,3.......n 
$$
计算中心：
$$
 \bar{x} = \frac{1}{n}\sum_{i=1}^{n}x_i
$$
中心化：
$$
\tilde{x}_i = x_i - \bar{x}
$$
将中心化后的数据组成一个矩阵：
$$

\tilde{X} = \begin{bmatrix}
            \tilde{x}_1& \tilde{x}_2&
            \tilde{x}_3&
            \cdots&
            \tilde{x}_n
            \end{bmatrix}

$$
则有 $\tilde{X} \in \mathbb{R}^{3 \times n}$
再对中心化矩阵进行SVD：
$$
 \tilde{X} = U \Sigma V^T
$$

- U 的列表示点云空间的主方向
- $\Sigma$中的奇异值表示这些方向的重要程度
- V 描述各数据点与主方向之间得到关系

排列奇异值：
$$
\sigma_1 \geq \sigma_2 \geq \sigma_3
$$
对应的主方向：
$$
u_1, u_2, u_3
$$
则：
- $u_1$: 第一主方向，点云方差最大的方向
- $u_2$: 第二主方向
- $u_3$: 第三主方向，点云点方差最小的方向

得到PCA结果，可以表示为
$$
U = \begin{bmatrix} 
    u_1&u_2&u_3
    \end{bmatrix} 
$$

则特征值可以表示为：
$$

\lambda_i = \frac{{\sigma_i}^2}{m}

$$
或为：
$$
\lambda_i = \frac{{\sigma_i}^2}{m-1}

$$

### kernel PCA

核主成分分析不是直接对原始数据做线性PCA，而是假设先把数据映射到一个更高维的空间，再在高维空间做PCA；通过核函数计算高维空间中的内积，从而避免真的构造高维数据

``` 
(base) E:\3DV\L_1\PointCloudHomeworkI\Homework I>conda env create -f cloud_lesson.yml
Channels:
 - conda-forge
 - defaults
Platform: win-64
Collecting package metadata (repodata.json): done
Solving environment: failed

PackagesNotFoundError: The following packages are not available from current channels:

  - zstd==1.4.4=hed8d7c8_2
  - zlib==1.2.11=h1de35cc_3
  - xz==5.2.4=h1de35cc_4
  - tornado==6.0.4=py36h37b9a7d_1
  - tk==8.6.10=hbbe82c9_0
  - sqlite==3.31.1=ha441bb4_0
  - scipy==1.4.1=py36h1dac7e4_2
  - scikit-learn==0.22.2.post1=py36h3dc85bc_0
  - readline==8.0=h1de35cc_0
  - python==3.6.10=hc70fcce_1
  - pillow==7.0.0=py36h2ae5dfa_1
  - pandas==1.0.3=py36hcc1bba6_0
  - openssl==1.1.1f=h0b31af3_0
  - numpy==1.18.1=py36hdc5ca10_1
  - ncurses==6.2=h0a44026_0
  - matplotlib-base==3.2.1=py36h83d3ec1_0
  - lz4-c==1.8.3=h6de7cb9_1001
  - llvm-openmp==9.0.1=h28b9765_2
  - libwebp-base==1.1.0=h0b31af3_3
  - libtiff==4.1.0=h2ae36a8_6
  - libpng==1.6.37=hbbe82c9_1
  - libopenblas==0.3.9=h3d69b6c_0
  - libgfortran==4.0.0=2
  - libffi==3.2.1=h475c297_4
  - libedit==3.1.20181209=hb402a30_0
  - libcxxabi==4.0.1=hcfea43d_1
  - libcxx==9.0.1=1
  - kiwisolver==1.1.0=py36h863e41a_1
  - jpeg==9c=h1de35cc_1001
  - freetype==2.10.1=h8da9a1a_0

Current channels:

  - https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/conda-forge/win-64
  - https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main/win-64
  - https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/r/win-64
  - https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/msys2/win-64

To search for alternate channels that may provide the conda package you're
looking for, navigate to

    https://anaconda.org

and use the search bar at the top of the page.

```
