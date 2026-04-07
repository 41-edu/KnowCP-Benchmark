export type Locale = "en" | "zh";

interface MessageTree {
  [key: string]: string | MessageTree;
}

export const messages: Record<Locale, MessageTree> = {
  en: {
    nav: {
      top: "Top",
      introduction: "Introduction",
      dataDistribution: "Data Distribution",
      questionDistribution: "Question Distribution",
      performance: "Performance",
    },
    hero: {
      title: "KnowCP: A Comprehensive Benchmark for Chinese Painting",
      subtitle: "Official benchmark website for dataset access, structured evaluation, and model comparison.",
      project: "Project",
      dataset: "Dataset",
      langEn: "EN",
      langZh: "中文",
    },
    intro: {
      title: "Introduction",
      fallbackDescription:
        "KnowCP evaluates visual perception, question answering, and cultural reasoning for Chinese painting understanding.",
      detectionTitle: "Visual Detection",
      detectionDesc:
        "Evaluate localized understanding of seals, inscriptions, objects, and technique regions with box-aware questions.",
      understandingTitle: "Visual Understanding",
      understandingDesc:
        "Evaluate recognition and reasoning from image-level and region-level evidence across structured question formats.",
      cultureTitle: "Vision-Culture Integration",
      cultureDesc:
        "Evaluate culturally grounded interpretation by combining visual evidence with art-historical and textual context.",
    },
    data: {
      title: "Data Distribution",
      collectionDistribution: "Collection Distribution",
      annotationDistribution: "Annotation Distribution",
      totalPaintings: "Total Paintings",
      seals: "Seals",
      inscriptions: "Inscriptions",
      elements: "Elements",
      techniques: "Techniques",
      count: "Count",
      paintings: "Paintings",
      imagesInSelection: "Images in Selection",
      others: "others",
      unknownMuseum: "Unknown Museum",
    },
    question: {
      title: "Question Distribution",
      number: "Number",
      cases: "Cases",
      categoryTotal: "Category Total",
      noAnswerLoaded: "No answer loaded.",
      noQuestionLoaded: "No question loaded.",
      noCaseImage: "No case image available for this entry.",
      previousImage: "Previous Image",
      nextImage: "Next Image",
      resetZoom: "Reset Zoom",
      previousQaContext: "Previous QA Context",
      question: "Question",
      answerGroundTruth: "Answer (ground truth)",
      answer: "Answer",
      totalGroups: "Total Groups",
      totalBoxes: "Total Boxes",
    },
    common: {
      first: "First",
      previous: "Previous",
      next: "Next",
      last: "Last",
      all: "All",
      loading: "Loading...",
      loadFailed: "Failed to load",
      close: "Close",
      model: "Model",
    },
    benchmark: {
      title: "Benchmark Performance",
      foundationalKnowledge: "Foundational Knowledge",
      visualContent: "Visual Content",
      deepReasoning: "Deep Reasoning",
      subtypes: {
        ITT: "Image-to-Title",
        MITT: "Multi-Image-to-Title",
        TTI: "Title-to-Image",
        MHQA: "Multi-hop-QA",
        SR: "Seal-Recognition",
        IR: "Inscription-Recognition",
        ER: "Element-Recognition",
        TR: "Technique-Recognition",
        VA: "Visual-Analysis",
        CC: "Cultural-Context",
        PR: "Provenance-Research",
      },
    },
    explorer: {
      resetZoom: "Reset Zoom",
      backToExplorer: "Back to Explorer",
    },
  },
  zh: {
    nav: {
      top: "顶部",
      introduction: "简介",
      dataDistribution: "数据分布",
      questionDistribution: "问题分布",
      performance: "性能",
    },
    hero: {
      title: "KnowCP：中国画综合评测基准",
      subtitle: "官方基准网站，提供数据集访问、结构化评测与模型对比。",
      project: "项目",
      dataset: "数据集",
      langEn: "EN",
      langZh: "中文",
    },
    intro: {
      title: "简介",
      fallbackDescription: "KnowCP 用于评估中国画理解中的视觉感知、问答能力与文化推理能力。",
      detectionTitle: "视觉检测",
      detectionDesc: "通过带框问题评估印章、题跋、物象与技法区域的定位与理解能力。",
      understandingTitle: "视觉理解",
      understandingDesc: "基于整图与局部证据，评估模型在结构化题型下的识别与推理能力。",
      cultureTitle: "视觉-文化融合",
      cultureDesc: "结合图像证据与美术史/文本背景，评估文化语境下的解释能力。",
    },
    data: {
      title: "数据分布",
      collectionDistribution: "馆藏分布",
      annotationDistribution: "标注分布",
      totalPaintings: "绘画总数",
      seals: "印章",
      inscriptions: "题跋",
      elements: "物象",
      techniques: "技法",
      count: "数量",
      paintings: "画作数",
      imagesInSelection: "当前选中图片总数",
      others: "其他",
      unknownMuseum: "未知馆藏",
    },
    question: {
      title: "问题分布",
      number: "数量",
      cases: "案例",
      categoryTotal: "类别总计",
      noAnswerLoaded: "未加载答案。",
      noQuestionLoaded: "未加载问题。",
      noCaseImage: "该条目暂无案例图片。",
      previousImage: "上一张",
      nextImage: "下一张",
      resetZoom: "重置缩放",
      previousQaContext: "前序问答上下文",
      question: "问题",
      answerGroundTruth: "答案（标准答案）",
      answer: "答案",
      totalGroups: "分组总数",
      totalBoxes: "框总数",
    },
    common: {
      first: "首页",
      previous: "上一页",
      next: "下一页",
      last: "末页",
      all: "全部",
      loading: "加载中...",
      loadFailed: "加载失败",
      close: "关闭",
      model: "模型",
    },
    benchmark: {
      title: "基准性能",
      foundationalKnowledge: "基础知识",
      visualContent: "视觉内容",
      deepReasoning: "深度推理",
      subtypes: {
        ITT: "图像到标题",
        MITT: "多图到标题",
        TTI: "标题到图像",
        MHQA: "多跳问答",
        SR: "印章识别",
        IR: "题跋识别",
        ER: "物象识别",
        TR: "技法识别",
        VA: "视觉分析",
        CC: "文化语境",
        PR: "流传考据",
      },
    },
    explorer: {
      resetZoom: "重置缩放",
      backToExplorer: "返回浏览器",
    },
  },
};

export function resolveMessage(locale: Locale, key: string): string | undefined {
  const parts = key.split(".");
  let cursor: string | MessageTree = messages[locale];
  for (const part of parts) {
    if (typeof cursor !== "object" || cursor === null || !(part in cursor)) {
      return undefined;
    }
    cursor = (cursor as MessageTree)[part] as string | MessageTree;
  }
  return typeof cursor === "string" ? cursor : undefined;
}
