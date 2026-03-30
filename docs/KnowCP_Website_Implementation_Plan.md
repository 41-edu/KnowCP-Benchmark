# KnowCP 数据集网站实施方案

## 1. 项目目标
构建一个用于论文数据集展示的 GitHub Pages 网站：

**KnowCP: A Comprehensive Benchmark from Foundational Knowledge to Deep Understanding for Chinese Painting**

网站需包含：
- 官方标题与两个外链（GitHub + Hugging Face）
- 封面区域
- 数据分布表格
- 物象全景交互（多层级分类）
- 技法全景交互（与物象同逻辑）
- 题型分布图与案例展示
- Benchmark Performance 表格

本文档用于定义完整实施流程与占位数据规范。注意：页面展示文案统一使用英文。

## 2. 技术选型
- 框架：React + Vite + TypeScript
- 路由：React Router（HashRouter，兼容 GitHub Pages）
- 图表：ECharts
- 图片查看：Lightbox 弹窗
- 样式：CSS 变量 + 响应式布局
- 部署：GitHub Actions 发布到 GitHub Pages

## 3. 信息架构

### 3.1 Hero 区域
- 主标题
- 副标题/描述占位
- 两个按钮：
  - `Project on GitHub`
  - `Dataset on Hugging Face`
- 封面图占位

### 3.2 Data Distribution 区域
包含两张表：
1. 博物馆收录分布：
   - 博物馆名称
   - 画作数量
2. 数据总量概览（多列）：
   - Total paintings
   - Seal annotations
   - Colophon annotations
   - Object annotations
   - Technique annotations

### 3.3 Object Panorama 区域
三级交互浏览流程：
1. 顶层物象类别页面
2. 二级类别页面（卡片背景取该类别第一张图）
3. 详情页：
   - 可选三级类别面板（存在三级时展示）
   - 当前类别图片集合
   - 标注框聚焦效果：
     - 框外区域虚化/降亮
     - 框内区域高亮并轻微放大
   - 点击图片可查看大图

### 3.4 Technique Panorama 区域
与 Object Panorama 使用同一套交互与组件架构，仅替换数据源。

### 3.5 Question Distribution 区域
- 多个题型分布图卡片
- 每个题型下方一个案例模块

### 3.6 Benchmark Performance 区域
- 一张按题型统计模型表现的表格
- 行列先使用占位，后续替换真实数据

## 4. 数据模型（占位优先）

### 4.1 博物馆分布
```json
[
  { "museum": "National Palace Museum", "paintings": 120 },
  { "museum": "The Palace Museum", "paintings": 95 }
]
```

### 4.2 全局总量
```json
{
  "totalPaintings": 1000,
  "sealAnnotations": 12000,
  "colophonAnnotations": 3400,
  "objectAnnotations": 28000,
  "techniqueAnnotations": 7600
}
```

### 4.3 全景分类（物象/技法通用）
```json
[
  {
    "id": "obj-plants",
    "name": "Plants",
    "level": 1,
    "children": [
      {
        "id": "obj-plants-bamboo",
        "name": "Bamboo",
        "level": 2,
        "coverImage": "https://...",
        "children": [
          {
            "id": "obj-plants-bamboo-leaf",
            "name": "Leaf",
            "level": 3,
            "images": []
          }
        ],
        "images": [
          {
            "id": "img-001",
            "imageUrl": "https://...",
            "bbox": { "x": 0.2, "y": 0.25, "width": 0.3, "height": 0.4 }
          }
        ]
      }
    ]
  }
]
```

### 4.4 题型分布与案例
```json
{
  "distributions": [
    { "questionType": "Object Recognition", "counts": [120, 90, 70] }
  ],
  "examples": [
    {
      "questionType": "Object Recognition",
      "question": "What object appears in the highlighted area?",
      "answer": "Bamboo"
    }
  ]
}
```

### 4.5 Benchmark Performance
```json
[
  {
    "model": "Model A",
    "overall": 62.1,
    "object": 65.0,
    "technique": 58.4,
    "seal": 60.2,
    "colophon": 63.5
  }
]
```

## 5. 组件设计
- `HeroSection`
- `DataDistributionSection`
- `PanoramaNavigator`（物象/技法共用）
- `CategoryGrid`
- `SubcategoryPanel`
- `FocusedImageCard`（bbox 聚焦 + 框外虚化）
- `ImageLightbox`
- `QuestionDistributionSection`
- `BenchmarkTableSection`

## 6. 路由设计
- `/` 首页（汇总各板块）
- `/panorama/object` 物象顶层类别
- `/panorama/object/:topId` 物象二级类别
- `/panorama/object/:topId/:secondId` 物象详情
- `/panorama/technique` 技法顶层类别
- `/panorama/technique/:topId` 技法二级类别
- `/panorama/technique/:topId/:secondId` 技法详情

使用 HashRouter，确保 GitHub Pages 刷新直达稳定可用。

## 7. 实施步骤
1. 初始化 Vite React TypeScript 项目
2. 安装依赖（router、charts、lightbox）
3. 建立全局主题与响应式布局
4. 完成首页各板块占位实现
5. 实现物象/技法共用全景引擎
6. 完成 bbox 聚焦效果与大图弹窗
7. 加入题型分布图与 benchmark 表格
8. 配置 GitHub Pages 自动部署
9. 编写 README（说明如何替换占位数据）

## 8. 占位策略
- 不确定信息全部使用占位字段
- 不额外写死论文结论型数据
- 外链统一集中在配置文件便于替换

## 9. 交付物
- 本地可运行的网站
- GitHub Pages 自动部署流程
- 结构化占位数据模块
- 可直接扩展的说明文档

## 10. 验收清单
- 页面标题与按钮文案为英文
- 封面区域存在
- Data Distribution 两张表完整
- Object Panorama 多层交互与聚焦效果可用
- Technique Panorama 复用同逻辑
- Question Distribution 图表与案例存在
- Benchmark Performance 表格存在
- 桌面端与移动端均可用
- 构建通过并可部署到 GitHub Pages
