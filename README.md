# KnowCP Website Template

本项目是用于 KnowCP 数据集展示的 GitHub Pages 网站模板。

页面展示文案为英文，方案文档为中文：
- `docs/KnowCP_Website_Implementation_Plan.md`

## 1. 快速启动

```bash
npm install
npm run dev
```

## 2. 生产构建

```bash
npm run build
```

构建产物在 `dist/`。

## 3. 页面模块

- Hero（标题、GitHub 链接、Hugging Face 链接、封面）
- Data Distribution（博物馆统计表 + 总量统计表）
- Object Panorama（多层级交互 + bbox 聚焦）
- Technique Panorama（与 Object Panorama 同逻辑）
- Question Type Distribution（多图表 + 每类案例）
- Benchmark Performance（模型表现表）

## 4. 主要数据文件（占位可替换）

- `src/data/siteContent.ts`：标题、链接、封面图
- `src/data/distribution.ts`：数据分布与总量
- `src/data/panorama.ts`：物象/技法全景树与图像 bbox
- `src/data/questions.ts`：题型分布与示例
- `src/data/benchmark.ts`：模型表现表

## 5. GitHub Pages 部署

已包含工作流：`.github/workflows/deploy.yml`

部署方式：
1. 将仓库推送到 GitHub 的 `main` 分支
2. 在仓库设置中启用 GitHub Pages（Source 选择 GitHub Actions）
3. 每次推送 `main` 自动构建并发布

## 6. 路由

项目使用 HashRouter，核心路由如下：
- `/#/`
- `/#/panorama/object`
- `/#/panorama/object/:topId/:secondId/:thirdId?`
- `/#/panorama/technique`
- `/#/panorama/technique/:topId/:secondId/:thirdId?`
