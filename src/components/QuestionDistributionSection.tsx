import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { LoadableImage } from "./LoadableImage";
import { TranslatedText } from "./TranslatedText";
import { useJsonContent } from "../hooks/useJsonContent";
import { useLocale } from "../hooks/useLocale";
import { resolvePublicUrl } from "../utils/url";

interface ChartBar {
  subtypeId: string;
  subtypeLabel: string;
  shortName: string;
  count: number;
}

interface ChartCategory {
  categoryId: string;
  categoryLabel: string;
  total: number;
  bars: ChartBar[];
}

interface SourceRef {
  id: string;
  label: string;
  count: number;
  caseFile: string;
  groupCount: number;
}

interface SubtypeRef {
  id: string;
  label: string;
  shortName: string;
  count: number;
  sources: SourceRef[];
}

interface CategoryRef {
  id: string;
  label: string;
  count: number;
  subtypes: SubtypeRef[];
}

interface QuestionSectionContent {
  chart: ChartCategory[];
  categories: CategoryRef[];
}

interface DistributionSummaryLite {
  datasetTotals: {
    sealAnnotations: number;
    inscriptionAnnotations: number;
  };
}

interface CaseQuestion {
  qid: string;
  imageId: string;
  type: string;
  questionNo: string;
  prompt: string;
  answer: unknown;
  images: string[];
  focusImageIndex: number;
  focusSubImageUrl: string | null;
  focusBBoxNorm?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

interface CaseGroup {
  id: string;
  mode: "single" | "mhqa" | "er_choice";
  label: string;
  tabs: string[];
  questionsByTab: Record<string, CaseQuestion>;
}

interface CasePayload {
  sourceId: string;
  groupCount: number;
  groups: CaseGroup[];
}

interface GlossaryPayload {
  items: Record<string, string>;
}

interface GroundTruthBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

interface FloatingTooltipState {
  text: string;
  anchorX: number;
  anchorY: number;
}

const fallbackContent: QuestionSectionContent = {
  chart: [],
  categories: [],
};

const fallbackDistributionSummary: DistributionSummaryLite = {
  datasetTotals: {
    sealAnnotations: 0,
    inscriptionAnnotations: 0,
  },
};

function formatAnswer(answer: unknown, noAnswerText: string): string {
  if (answer === null || answer === undefined) {
    return noAnswerText;
  }
  if (typeof answer === "string") {
    return answer.replace(/\\n/g, "\n");
  }
  if (typeof answer === "number" || typeof answer === "boolean") {
    return String(answer);
  }
  if (Array.isArray(answer)) {
    return answer.map((item) => formatAnswer(item, noAnswerText)).join(" / ");
  }
  try {
    return JSON.stringify(answer, null, 2);
  } catch {
    return String(answer);
  }
}

function normalizeMultilineText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/\\n/g, "\n");
}

function normalizeImageKey(url: string): string {
  const text = String(url || "").trim();
  if (!text) {
    return "";
  }
  const noQuery = text.split("?")[0].split("#")[0];
  const segments = noQuery.split("/").filter(Boolean);
  return (segments[segments.length - 1] || noQuery).toLowerCase();
}

function parseGroundTruthBoxes(question: CaseQuestion | undefined, activeImageUrl: string): GroundTruthBox[] {
  if (!question) {
    return [];
  }

  const answer = question.answer as
    | { items?: Array<{ bbox?: unknown; sub_image_path?: string; text?: unknown }> }
    | undefined;
  const items = Array.isArray(answer?.items) ? answer.items : [];
  const activeKey = normalizeImageKey(activeImageUrl);

  return items
    .map((item, index) => {
      const subImageKey = item?.sub_image_path ? normalizeImageKey(String(item.sub_image_path)) : "";
      if (subImageKey && activeKey && subImageKey !== activeKey) {
        return null;
      }

      const box = Array.isArray(item?.bbox) ? item.bbox : [];
      if (box.length < 4) {
        return null;
      }

      const x1 = Number(box[0]);
      const y1 = Number(box[1]);
      const x2 = Number(box[2]);
      const y2 = Number(box[3]);
      if (![x1, y1, x2, y2].every((value) => Number.isFinite(value))) {
        return null;
      }

      const left = Math.max(0, Math.min(1, Math.min(x1, x2)));
      const top = Math.max(0, Math.min(1, Math.min(y1, y2)));
      const right = Math.max(0, Math.min(1, Math.max(x1, x2)));
      const bottom = Math.max(0, Math.min(1, Math.max(y1, y2)));

      if (right <= left || bottom <= top) {
        return null;
      }

      return {
        id: `gt-${question.qid}-${index}`,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        text: normalizeMultilineText(item?.text).trim(),
      };
    })
    .filter((item): item is GroundTruthBox => Boolean(item));
}

function resolvePreferredImageIndex(question?: CaseQuestion | null): number {
  if (!question?.images?.length) {
    return 0;
  }

  if (question.focusSubImageUrl) {
    const focusKey = normalizeImageKey(question.focusSubImageUrl);
    if (focusKey) {
      const matchIndex = question.images.findIndex((imageUrl) => normalizeImageKey(imageUrl) === focusKey);
      if (matchIndex >= 0) {
        return matchIndex;
      }
    }
  }

  const focusIndex = Number(question.focusImageIndex);
  if (Number.isFinite(focusIndex) && focusIndex >= 0 && focusIndex < question.images.length) {
    return focusIndex;
  }

  return 0;
}

function questionStepNo(value: string): number {
  const match = String(value || "").toUpperCase().match(/^Q(\d+)$/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function isChoiceQuestionType(questionType?: string): boolean {
  const upper = String(questionType || "").toUpperCase();
  return upper === "ITT" || upper === "MITT" || upper === "TTI" || upper === "ER_CHOICE" || upper === "TR_CHOICE" || upper === "ITT_MHQA_CHOICE" || upper === "MITT_MHQA_CHOICE";
}

function shouldPreserveChoiceOptions(questionType?: string): boolean {
  return isChoiceQuestionType(questionType);
}

function formatChoiceAnswer(answer: unknown, noAnswerText: string): string {
  if (answer === null || answer === undefined) {
    return noAnswerText;
  }
  const text = String(answer).trim();
  if (!text) {
    return noAnswerText;
  }

  const exact = text.match(/^[A-D]$/i);
  if (exact) {
    return exact[0].toUpperCase();
  }

  const contained = text.match(/\b([A-D])\b/i);
  if (contained) {
    return contained[1].toUpperCase();
  }

  return text;
}

function renderCasePromptSegments(
  prompt: string,
  questionType?: string,
  options?: { locale?: string; glossary?: Record<string, string> },
) {
  const text = normalizeMultilineText(prompt);
  const upperType = String(questionType || "").toUpperCase();
  const locale = String(options?.locale || "en");
  const glossary = options?.glossary || {};

  if (!text) {
    return null;
  }

  if (upperType === "ITT" || upperType === "MITT") {
    const lines = text.split("\n");
    return (
      <>
        {lines.map((line, idx) => (
          <Fragment key={`${upperType}-line-${idx}-${line.slice(0, 16)}`}>
            {/^[A-D]\.\s/.test(line.trim()) ? line : <TranslatedText text={line} />}
            {idx < lines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </>
    );
  }

  if (upperType === "TTI") {
    const match = text.match(/^(.*?已知作品标题为：)(.+?)(。请判断它对应下列四张图中的哪一张？[\s\S]*)$/);
    if (match) {
      return (
        <>
          <TranslatedText text={match[1]} />
          {match[2]}
          <TranslatedText text={match[3]} />
        </>
      );
    }
  }

  if (upperType === "ER_CHOICE" || upperType === "TR_CHOICE") {
    const mapCategoryPath = (value: string) => {
      const parts = value.split(/(\s*\/\s*)/);
      return parts
        .map((part) => {
          const trimmed = part.trim();
          if (!trimmed || trimmed === "/") {
            return part;
          }
          return glossary[trimmed] || trimmed;
        })
        .join("");
    };

    const mapInstructionLineEn = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return "";
      }

      if (upperType === "ER_CHOICE") {
        if (trimmed === "请观察红框中的主体物象，判断其一级类别。") {
          return "Please observe the main object in the red box and judge its first-level category.";
        }
        if (trimmed === "请观察红框中的主体物象，判断其二级类别。") {
          return "Please observe the main object in the red box and judge its second-level category.";
        }
        if (trimmed === "请观察红框中的主体物象，判断其三级类别。") {
          return "Please observe the main object in the red box and judge its third-level category.";
        }
      }

      if (upperType === "TR_CHOICE") {
        if (trimmed === "请只根据红框区域中的笔法与皴法特征作答。") {
          return "Please answer based only on the brushwork and texture-stroke features in the red box.";
        }
      }

      if (trimmed === "要求：") {
        return "Requirements:";
      }
      if (trimmed === "这是单选题。") {
        return "This is a multiple-choice question.";
      }
      if (trimmed === "1）只依据红框内容作答，不参考画面其他区域。") {
        return "1) Answer only based on the red-box content, without referring to other image regions.";
      }
      if (trimmed === "2）本题为单选题，只输出一个选项字母（如 A）。") {
        return "2) This is a multiple-choice question; output only one option letter (e.g., A).";
      }
      if (trimmed === "选项：") {
        return "Options:";
      }
      if (trimmed === "只输出一个选项字母，不要解释。") {
        return "Print only one option letter, without explanation.";
      }
      if (trimmed === "输出格式硬约束：") {
        return "Output format hard constraints:";
      }
      if (trimmed === "- 只输出一个选项字母（如 A）。") {
        return "- Print only one option letter (such as A).";
      }
      if (trimmed === "- 禁止输出解释、标点、额外文本。") {
        return "- The output of explanations, punctuation, and additional text is prohibited.";
      }

      const upperMatch = trimmed.match(/^已确定上层类别：\s*(.+)$/);
      if (upperMatch) {
        return `The upper-level category has been determined as: ${mapCategoryPath(upperMatch[1])}`;
      }

      return null;
    };

    const lines = text.split("\n");
    return (
      <>
        {lines.map((line, idx) => {
          const optionMatch = line.trim().match(/^([A-Z])\.\s*(.+)$/);
          if (optionMatch) {
            if (locale === "en") {
              const optionText = String(optionMatch[2] || "").trim();
              const mapped = glossary[optionText] || optionText;
              return (
                <Fragment key={`${upperType}-opt-${idx}-${optionMatch[1]}`}>
                  {`${optionMatch[1]}. ${mapped}`}
                  {idx < lines.length - 1 ? <br /> : null}
                </Fragment>
              );
            }
            return (
              <Fragment key={`${upperType}-opt-zh-${idx}-${optionMatch[1]}`}>
                {line}
                {idx < lines.length - 1 ? <br /> : null}
              </Fragment>
            );
          }

          if (locale === "en") {
            const mappedLine = mapInstructionLineEn(line);
            if (mappedLine !== null) {
              return (
                <Fragment key={`${upperType}-line-fixed-${idx}-${line.slice(0, 16)}`}>
                  {mappedLine}
                  {idx < lines.length - 1 ? <br /> : null}
                </Fragment>
              );
            }
          }

          return (
            <Fragment key={`${upperType}-line-${idx}-${line.slice(0, 16)}`}>
              {locale === "en" ? <TranslatedText text={line} /> : line}
              {idx < lines.length - 1 ? <br /> : null}
            </Fragment>
          );
        })}
      </>
    );
  }

  return <TranslatedText text={text} preserveChoiceOptions={shouldPreserveChoiceOptions(questionType)} />;
}

export function QuestionDistributionSection() {
  const { t, locale } = useLocale();
  const glossaryPayload = useJsonContent<GlossaryPayload>("/content/glossary-zh-en.json", { items: {} });
  const glossaryMap = glossaryPayload.items || {};
  const content = useJsonContent<QuestionSectionContent>("/content/question-section.json", fallbackContent);
  const distributionSummary = useJsonContent<DistributionSummaryLite>(
    "/content/data-distribution.json",
    fallbackDistributionSummary,
  );

  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [activeSubtypeId, setActiveSubtypeId] = useState("");
  const [activeSourceId, setActiveSourceId] = useState("");
  const [casePayload, setCasePayload] = useState<CasePayload | null>(null);
  const [page, setPage] = useState(1);
  const [innerTab, setInnerTab] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 });
  const imageViewportRef = useRef<HTMLDivElement | null>(null);
  const caseImageStageRef = useRef<HTMLDivElement | null>(null);
  const caseTooltipRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const questionPanelRef = useRef<HTMLDivElement | null>(null);
  const answerPanelRef = useRef<HTMLDivElement | null>(null);
  const qaPanelRef = useRef<HTMLDivElement | null>(null);
  const [renderedImageSize, setRenderedImageSize] = useState({ width: 0, height: 0 });
  const [qaRatio, setQaRatio] = useState(0.8);
  const [resizingQa, setResizingQa] = useState(false);
  const [mhqaQ1Map, setMhqaQ1Map] = useState<Record<string, CaseQuestion>>({});
  const [caseTooltip, setCaseTooltip] = useState<FloatingTooltipState | null>(null);
  const [caseTooltipPos, setCaseTooltipPos] = useState({ left: 10, top: 10 });

  const computeContainSize = (naturalWidth: number, naturalHeight: number) => {
    const viewport = imageViewportRef.current;
    if (!viewport || naturalWidth <= 0 || naturalHeight <= 0) {
      return { width: 0, height: 0 };
    }
    const scale = Math.min(viewport.clientWidth / naturalWidth, viewport.clientHeight / naturalHeight);
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return {
      width: Math.max(1, Math.floor(naturalWidth * safeScale)),
      height: Math.max(1, Math.floor(naturalHeight * safeScale)),
    };
  };

  const activeCategory = content.categories.find((item) => item.id === activeCategoryId) ?? content.categories[0];
  const activeSubtype =
    activeCategory?.subtypes.find((item) => item.id === activeSubtypeId) ?? activeCategory?.subtypes[0];
  const activeSource = activeSubtype?.sources.find((item) => item.id === activeSourceId) ?? activeSubtype?.sources[0];

  useEffect(() => {
    if (!content.categories.length) {
      return;
    }
    if (!activeCategoryId) {
      setActiveCategoryId(content.categories[0].id);
    }
  }, [activeCategoryId, content.categories]);

  useEffect(() => {
    if (!activeCategory?.subtypes.length) {
      return;
    }
    if (!activeSubtypeId || !activeCategory.subtypes.some((item) => item.id === activeSubtypeId)) {
      setActiveSubtypeId(activeCategory.subtypes[0].id);
    }
  }, [activeCategory, activeSubtypeId]);

  useEffect(() => {
    if (!activeSubtype?.sources.length) {
      return;
    }
    if (!activeSourceId || !activeSubtype.sources.some((item) => item.id === activeSourceId)) {
      setActiveSourceId(activeSubtype.sources[0].id);
    }
  }, [activeSourceId, activeSubtype]);

  useEffect(() => {
    if (!activeSource?.caseFile) {
      return;
    }
    setInnerTab("");
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);

    let cancelled = false;

    async function loadCases() {
      try {
        const response = await fetch(resolvePublicUrl(activeSource.caseFile), { cache: "force-cache" });
        if (!response.ok) {
          return;
        }
        const parsed = (await response.json()) as CasePayload;
        if (!cancelled) {
          setCasePayload(parsed);
          setPage(1);
        }
      } catch {
        // Keep previous case data when loading fails.
      }
    }

    loadCases();

    return () => {
      cancelled = true;
    };
  }, [activeSource?.caseFile]);

  useEffect(() => {
    const sourceId = String(activeSource?.id || "");
    const baseCaseFile = sourceId.startsWith("ITT_MHQA")
      ? "/content/question-cases/ITT.json"
      : sourceId.startsWith("MITT_MHQA")
        ? "/content/question-cases/MITT.json"
        : "";

    if (!baseCaseFile) {
      setMhqaQ1Map({});
      return;
    }

    let cancelled = false;
    async function loadQ1Map() {
      try {
        const response = await fetch(resolvePublicUrl(baseCaseFile), { cache: "force-cache" });
        if (!response.ok) {
          return;
        }
        const parsed = (await response.json()) as CasePayload;
        const nextMap: Record<string, CaseQuestion> = {};
        for (const group of parsed?.groups || []) {
          const tabKey = group?.tabs?.[0] || "Q";
          const q = group?.questionsByTab?.[tabKey];
          if (!q?.imageId) {
            continue;
          }
          nextMap[q.imageId] = q;
        }
        if (!cancelled) {
          setMhqaQ1Map(nextMap);
        }
      } catch {
        // keep empty Q1 context map on transient fetch errors
      }
    }

    loadQ1Map();
    return () => {
      cancelled = true;
    };
  }, [activeSource?.id]);

  const groups = casePayload?.groups ?? [];
  const totalPages = Math.max(1, groups.length);
  const currentPage = Math.min(page, totalPages);
  const activeGroup = groups[currentPage - 1];

  useEffect(() => {
    const nextTab = activeGroup?.tabs?.[0] ?? "";
    setInnerTab(nextTab);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
  }, [activeGroup?.id]);

  const activeQuestion =
    (activeGroup && activeGroup.questionsByTab[innerTab]) ||
    (activeGroup && activeGroup.questionsByTab[activeGroup.tabs[0]]);

  const activeImageUrl = activeQuestion?.images?.[imageIndex] ?? "";

  const mhqaContext = useMemo(() => {
    if (!activeGroup || activeGroup.mode !== "mhqa") {
      return [] as Array<{ tab: string; question: CaseQuestion }>;
    }

    const currentTab = innerTab || activeGroup.tabs[0];
    const currentStep = questionStepNo(currentTab);
    if (!Number.isFinite(currentStep)) {
      return [];
    }

    const previousInGroup = [...activeGroup.tabs]
      .sort((a, b) => questionStepNo(a) - questionStepNo(b))
      .filter((tab) => questionStepNo(tab) < currentStep)
      .map((tab) => ({ tab, question: activeGroup.questionsByTab[tab] }))
      .filter((item) => Boolean(item.question));

    const q1 = activeQuestion?.imageId ? mhqaQ1Map[activeQuestion.imageId] : undefined;
    if (q1) {
      return [{ tab: "Q1", question: q1 }, ...previousInGroup];
    }
    return previousInGroup;
  }, [activeGroup, activeQuestion?.imageId, innerTab, mhqaQ1Map]);

  const getCategoryLabel = (categoryId: string, fallback: string) => {
    if (categoryId === "foundational-knowledge") {
      return t("benchmark.foundationalKnowledge", fallback);
    }
    if (categoryId === "visual-content") {
      return t("benchmark.visualContent", fallback);
    }
    if (categoryId === "deep-reasoning") {
      return t("benchmark.deepReasoning", fallback);
    }
    return fallback;
  };

  const getSubtypeLabel = (shortName: string, fallback: string) => {
    return t(`benchmark.subtypes.${shortName}`, fallback);
  };

  const chartOption = useMemo(() => {
    const xLabels = content.chart.map((item) => getCategoryLabel(item.categoryId, item.categoryLabel));
    const categoryPalette: Record<string, string[]> = {
      "foundational-knowledge": ["#8b4a2f", "#a95d35", "#c5723b", "#e1904a", "#f0aa72"],
      "visual-content": ["#205a5e", "#2b6f73", "#37858a", "#49a0a5", "#75bfc3"],
      "deep-reasoning": ["#39542c", "#4b6a3a", "#5d8146", "#749d58", "#91b86f"],
    };
    const maxBars = Math.max(0, ...content.chart.map((category) => category.bars.length));

    const series = Array.from({ length: maxBars }, (_, barIndex) => ({
      name: `bar-${barIndex + 1}`,
      type: "bar",
      barMaxWidth: 24,
      barGap: "16%",
      barCategoryGap: "40%",
      emphasis: { focus: "series" },
      data: content.chart.map((category) => {
        const bar = category.bars[barIndex];
        if (!bar) {
          return {
            value: 0,
            itemStyle: { color: "transparent" },
            tooltip: { show: false },
            emphasis: { disabled: true },
            silent: true,
          };
        }
        const palette = categoryPalette[category.categoryId] || ["#6a7a82"];
        return {
          value: bar.count,
          categoryId: category.categoryId,
            categoryLabel: getCategoryLabel(category.categoryId, category.categoryLabel),
          categoryTotal: category.total,
            subtypeLabel: getSubtypeLabel(bar.shortName, bar.subtypeLabel),
          shortName: bar.shortName,
          itemStyle: {
            color: palette[barIndex % palette.length],
          },
        };
      }),
    }));

    return {
      tooltip: {
        trigger: "item",
        formatter: (params: {
          value?: number;
          data?: {
            categoryLabel?: string;
            categoryTotal?: number;
            subtypeLabel?: string;
            shortName?: string;
          };
        }) => {
          const item = params.data;
          if (!item) {
            return "";
          }
          const total = Number(item.categoryTotal || 0).toLocaleString();
          const value = Number(params.value || 0).toLocaleString();
          return [
            `${item.categoryLabel || ""}`,
            `${item.subtypeLabel || ""} (${item.shortName || ""}): ${value}`,
            `${t("question.categoryTotal")}: ${total}`,
          ].join("<br/>");
        },
      },
      legend: {
        show: false,
      },
      xAxis: {
        type: "category",
        data: xLabels,
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: "value",
        name: t("question.number"),
        nameLocation: "middle",
        nameGap: 46,
      },
      series,
      grid: { left: 72, right: 22, top: 24, bottom: 45, containLabel: true },
    };
  }, [content.chart, t]);

  useEffect(() => {
    if (!resizingQa) {
      return;
    }

    const handleMove = (event: MouseEvent) => {
      const panel = qaPanelRef.current;
      if (!panel) {
        return;
      }
      const rect = panel.getBoundingClientRect();
      if (rect.height <= 0) {
        return;
      }
      const ratio = (event.clientY - rect.top) / rect.height;
      setQaRatio(Math.max(0.6, Math.min(0.9, ratio)));
    };

    const handleUp = () => {
      setResizingQa(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizingQa]);

  const clampOffset = (nextOffset: { x: number; y: number }, nextZoom: number) => {
    const viewport = imageViewportRef.current;
    if (!viewport || renderedImageSize.width <= 0 || renderedImageSize.height <= 0) {
      return nextOffset;
    }

    const maxX = Math.max(0, (renderedImageSize.width * nextZoom - viewport.clientWidth) / 2);
    const maxY = Math.max(0, (renderedImageSize.height * nextZoom - viewport.clientHeight) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, nextOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, nextOffset.y)),
    };
  };

  useEffect(() => {
    setOffset((prev) => clampOffset(prev, zoom));
  }, [zoom, renderedImageSize.width, renderedImageSize.height]);

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    if (event.cancelable) {
      event.preventDefault();
    }
    const next = event.deltaY < 0 ? zoom * 1.12 : zoom / 1.12;
    const clampedZoom = Math.max(0.6, Math.min(4, next));
    setZoom(clampedZoom);
    setOffset((prev) => clampOffset(prev, clampedZoom));
  };

  const updateCaseTooltipPosition = (anchorX: number, anchorY: number) => {
    const viewport = imageViewportRef.current;
    const tooltip = caseTooltipRef.current;
    if (!viewport || !tooltip) {
      return;
    }

    const gap = 12;
    const pad = 8;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const tooltipWidth = tooltip.offsetWidth || 220;
    const tooltipHeight = tooltip.offsetHeight || 120;
    const viewportRect = viewport.getBoundingClientRect();
    const stageRect = caseImageStageRef.current?.getBoundingClientRect();

    const bounds = (() => {
      if (!stageRect) {
        return {
          left: pad,
          top: pad,
          right: viewportWidth - pad,
          bottom: viewportHeight - pad,
        };
      }

      const visibleLeft = Math.max(stageRect.left, viewportRect.left) - viewportRect.left;
      const visibleTop = Math.max(stageRect.top, viewportRect.top) - viewportRect.top;
      const visibleRight = Math.min(stageRect.right, viewportRect.right) - viewportRect.left;
      const visibleBottom = Math.min(stageRect.bottom, viewportRect.bottom) - viewportRect.top;

      if (visibleRight - visibleLeft <= 24 || visibleBottom - visibleTop <= 24) {
        return {
          left: pad,
          top: pad,
          right: viewportWidth - pad,
          bottom: viewportHeight - pad,
        };
      }

      return {
        left: Math.max(pad, visibleLeft + pad),
        top: Math.max(pad, visibleTop + pad),
        right: Math.min(viewportWidth - pad, visibleRight - pad),
        bottom: Math.min(viewportHeight - pad, visibleBottom - pad),
      };
    })();

    let left = anchorX + gap;
    let top = anchorY - tooltipHeight - gap;

    if (left + tooltipWidth > bounds.right) {
      left = anchorX - tooltipWidth - gap;
    }
    left = Math.max(bounds.left, Math.min(bounds.right - tooltipWidth, left));

    if (top < bounds.top) {
      top = anchorY + gap;
    }
    top = Math.max(bounds.top, Math.min(bounds.bottom - tooltipHeight, top));

    setCaseTooltipPos({ left, top });
  };

  const showCaseTooltip = (event: React.MouseEvent<HTMLDivElement>, text: string) => {
    const viewport = imageViewportRef.current;
    if (!viewport || !text) {
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    setCaseTooltip({ text, anchorX, anchorY });
  };

  useEffect(() => {
    if (!caseTooltip) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      updateCaseTooltipPosition(caseTooltip.anchorX, caseTooltip.anchorY);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [caseTooltip, zoom, offset.x, offset.y, renderedImageSize.width, renderedImageSize.height]);

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setLastPoint({ x: event.clientX, y: event.clientY });
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!dragging) {
      return;
    }
    const dx = event.clientX - lastPoint.x;
    const dy = event.clientY - lastPoint.y;
    setOffset((prev) => clampOffset({ x: prev.x + dx, y: prev.y + dy }, zoom));
    setLastPoint({ x: event.clientX, y: event.clientY });
  };

  const stopDragging = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (!activeQuestion?.images?.length) {
      setImageIndex(0);
      return;
    }
    setImageIndex(resolvePreferredImageIndex(activeQuestion));
  }, [activeQuestion?.qid, activeQuestion?.images?.length, activeQuestion?.focusSubImageUrl, activeQuestion?.focusImageIndex]);

  const shouldShowBBox =
    Boolean(activeQuestion?.focusBBoxNorm) &&
    (!activeQuestion?.focusSubImageUrl ||
      normalizeImageKey(activeQuestion.focusSubImageUrl) === normalizeImageKey(activeImageUrl));

  const normalizedFocusBBox = (() => {
    const raw = activeQuestion?.focusBBoxNorm;
    if (!raw) {
      return null;
    }
    const x1 = Math.max(0, Math.min(1, raw.x));
    const y1 = Math.max(0, Math.min(1, raw.y));
    const x2 = Math.max(x1, Math.min(1, raw.x + raw.width));
    const y2 = Math.max(y1, Math.min(1, raw.y + raw.height));
    return {
      x: x1,
      y: y1,
      width: Math.max(0, x2 - x1),
      height: Math.max(0, y2 - y1),
    };
  })();

  const groundTruthBoxes = useMemo(
    () => parseGroundTruthBoxes(activeQuestion, activeImageUrl),
    [activeImageUrl, activeQuestion],
  );

  const totalBoxes = useMemo(() => {
    const sourceId = String(activeSource?.id || "");
    if (sourceId === "SR") {
      return Number(distributionSummary.datasetTotals.sealAnnotations || 0);
    }
    if (sourceId === "IR") {
      return Number(distributionSummary.datasetTotals.inscriptionAnnotations || 0);
    }
    return null;
  }, [activeSource?.id, distributionSummary.datasetTotals.inscriptionAnnotations, distributionSummary.datasetTotals.sealAnnotations]);

  const handleImageLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
    const target = event.currentTarget;
    imageRef.current = target;
    setRenderedImageSize(computeContainSize(target.naturalWidth, target.naturalHeight));
    setOffset((prev) => clampOffset(prev, zoom));
  };

  useEffect(() => {
    const onResize = () => {
      const image = imageRef.current;
      if (!image || !image.naturalWidth || !image.naturalHeight) {
        return;
      }
      setRenderedImageSize(computeContainSize(image.naturalWidth, image.naturalHeight));
      setOffset((prev) => clampOffset(prev, zoom));
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [zoom]);

  useEffect(() => {
    if (questionPanelRef.current) {
      questionPanelRef.current.scrollTop = 0;
    }
    if (answerPanelRef.current) {
      answerPanelRef.current.scrollTop = 0;
    }
  }, [activeQuestion?.qid]);

  useEffect(() => {
    setCaseTooltip(null);
  }, [activeQuestion?.qid, activeImageUrl]);

  return (
    <section className="section-block" id="question-distribution">
      <div className="section-head center-head">
        <h2>{t("question.title")}</h2>
      </div>

      <div className="question-single-block">
        <article className="question-card full-width transparent-card">
          <h3 className="subsection-title">{t("question.number")}</h3>
          <ReactECharts option={chartOption} style={{ height: 340 }} />
        </article>

        <article className="question-card full-width transparent-card">
          <h3 className="subsection-title">{t("question.cases")}</h3>

          <div className="case-tab-row">
            {(content.categories || []).map((category) => (
              <button
                key={category.id}
                className={`case-tab ${activeCategory?.id === category.id ? "active" : ""}`}
                onClick={() => setActiveCategoryId(category.id)}
                type="button"
              >
                {getCategoryLabel(category.id, category.label)}
              </button>
            ))}
          </div>

          <div className="case-tab-row">
            {(activeCategory?.subtypes || []).map((subtype) => (
              <button
                key={subtype.id}
                className={`case-tab subtype-tab subtype-of-${activeCategory?.id || ""} ${
                  activeSubtype?.id === subtype.id ? "active" : ""
                }`}
                onClick={() => setActiveSubtypeId(subtype.id)}
                type="button"
              >
                  {getSubtypeLabel(subtype.shortName, subtype.label)}
              </button>
            ))}
          </div>

          <div className="case-tab-row">
            {(activeSubtype?.sources || []).map((source) => (
              <button
                key={source.id}
                className={`case-tab ${activeSource?.id === source.id ? "active" : ""}`}
                onClick={() => setActiveSourceId(source.id)}
                type="button"
              >
                {source.label}
              </button>
            ))}
          </div>

          {activeGroup && activeGroup.tabs.length > 1 && (
            <div className="case-tab-row">
              {activeGroup.tabs.map((tab) => (
                <button
                  key={tab}
                  className={`case-tab ${innerTab === tab ? "active" : ""}`}
                  onClick={() => setInnerTab(tab)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          <div className="case-two-col">
            <div className="case-image-panel">
              {activeQuestion && activeQuestion.images.length > 0 ? (
                <>
                  <div
                    className="case-image-viewport"
                    ref={imageViewportRef}
                    onWheelCapture={handleWheel}
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDragging}
                    onPointerCancel={stopDragging}
                    onPointerLeave={stopDragging}
                  >
                    <div
                      className="case-image-stage"
                      ref={caseImageStageRef}
                      style={{
                        width: renderedImageSize.width > 0 ? `${renderedImageSize.width}px` : undefined,
                        height: renderedImageSize.height > 0 ? `${renderedImageSize.height}px` : undefined,
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                      }}
                    >
                      <LoadableImage
                        src={resolvePublicUrl(activeImageUrl)}
                        alt={activeQuestion.imageId}
                        className="case-image"
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                        onLoad={handleImageLoad}
                        loadingText={t("common.loading")}
                        errorText={t("common.loadFailed")}
                      />
                      {shouldShowBBox && normalizedFocusBBox && (
                        <div
                          className="case-focus-bbox"
                          style={{
                            left: `${normalizedFocusBBox.x * 100}%`,
                            top: `${normalizedFocusBBox.y * 100}%`,
                            width: `${normalizedFocusBBox.width * 100}%`,
                            height: `${normalizedFocusBBox.height * 100}%`,
                          }}
                        />
                      )}
                      {groundTruthBoxes.map((box) => (
                        <div
                          key={box.id}
                          className="case-gt-bbox"
                          style={{
                            left: `${box.x * 100}%`,
                            top: `${box.y * 100}%`,
                            width: `${box.width * 100}%`,
                            height: `${box.height * 100}%`,
                          }}
                          onMouseEnter={(event) => showCaseTooltip(event, box.text)}
                          onMouseMove={(event) => showCaseTooltip(event, box.text)}
                          onMouseLeave={() => setCaseTooltip(null)}
                        />
                      ))}
                    </div>
                    {caseTooltip ? (
                      <div
                        className="case-bbox-tooltip case-bbox-tooltip-floating"
                        style={{ left: `${caseTooltipPos.left}px`, top: `${caseTooltipPos.top}px` }}
                        ref={caseTooltipRef}
                      >
                        {caseTooltip.text}
                      </div>
                    ) : null}
                  </div>

                  <div className="case-image-toolbar">
                    <button
                      type="button"
                      onClick={() => setImageIndex((prev) => Math.max(0, prev - 1))}
                      disabled={imageIndex <= 0}
                    >
                      {t("question.previousImage")}
                    </button>
                    <span>
                      {imageIndex + 1} / {activeQuestion.images.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setImageIndex((prev) => Math.min(activeQuestion.images.length - 1, prev + 1))
                      }
                      disabled={imageIndex >= activeQuestion.images.length - 1}
                    >
                      {t("question.nextImage")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoom(1);
                        setOffset({ x: 0, y: 0 });
                      }}
                    >
                      {t("question.resetZoom")}
                    </button>
                  </div>
                </>
              ) : (
                <p className="empty-hint">{t("question.noCaseImage")}</p>
              )}
            </div>

            <div
              className={`case-qa-panel ${resizingQa ? "resizing" : ""}`}
              ref={qaPanelRef}
              style={{ gridTemplateRows: `${qaRatio}fr 10px ${Math.max(0.1, 1 - qaRatio)}fr` }}
            >
              <div className="question-example" ref={questionPanelRef}>
                {mhqaContext.length > 0 && (
                  <div className="mhqa-context-block">
                    <p>
                      <strong>{t("question.previousQaContext")}</strong>
                    </p>
                    {mhqaContext.map((item) => (
                      <div key={item.tab} className="mhqa-context-item">
                        <p>
                          <strong>{item.tab}</strong>
                        </p>
                        <p>
                          {renderCasePromptSegments(item.question.prompt, item.question.type, {
                            locale,
                            glossary: glossaryMap,
                          })}
                        </p>
                        <p>
                          <strong>{t("question.answer")}:</strong>{" "}
                          {isChoiceQuestionType(item.question.type) ? (
                            formatChoiceAnswer(item.question.answer, t("question.noAnswerLoaded"))
                          ) : (
                            <TranslatedText
                              text={formatAnswer(item.question.answer, t("question.noAnswerLoaded"))}
                              preserveChoiceOptions={shouldPreserveChoiceOptions(item.question.type)}
                            />
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p>
                  <strong>{t("question.question")}</strong>
                </p>
                <p className="question-prompt-block">
                  {normalizeMultilineText(activeQuestion?.prompt) ? (
                    renderCasePromptSegments(activeQuestion?.prompt || "", activeQuestion?.type, {
                      locale,
                      glossary: glossaryMap,
                    })
                  ) : (
                    t("question.noQuestionLoaded")
                  )}
                </p>
              </div>
              <div
                className="qa-resizer"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize question and answer"
                onMouseDown={() => setResizingQa(true)}
              />
              <div className="question-example" ref={answerPanelRef}>
                <p>
                  <strong>{t("question.answerGroundTruth")}</strong>
                </p>
                <pre className="answer-text-block">
                  {isChoiceQuestionType(activeQuestion?.type) ? (
                    formatChoiceAnswer(activeQuestion?.answer, t("question.noAnswerLoaded"))
                  ) : String(activeQuestion?.type || "").toUpperCase() === "ER_FILLIN" ||
                    String(activeQuestion?.type || "").toUpperCase() === "TR_FILLIN" ? (
                    locale === "en"
                      ? glossaryMap[formatAnswer(activeQuestion?.answer, t("question.noAnswerLoaded"))] ||
                        formatAnswer(activeQuestion?.answer, t("question.noAnswerLoaded"))
                      : formatAnswer(activeQuestion?.answer, t("question.noAnswerLoaded"))
                  ) : (
                    <TranslatedText
                      text={formatAnswer(activeQuestion?.answer, t("question.noAnswerLoaded"))}
                      preserveChoiceOptions={shouldPreserveChoiceOptions(activeQuestion?.type)}
                    />
                  )}
                </pre>
              </div>
            </div>
          </div>

          <div className="explorer-footer">
            <span className="explorer-total">
              {t("question.totalGroups")}: {groups.length.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
            </span>
            {totalBoxes !== null && (
              <span className="explorer-total">
                {t("question.totalBoxes")}: {totalBoxes.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
              </span>
            )}
            <div className="explorer-pagination">
              <button type="button" onClick={() => setPage(1)} disabled={currentPage <= 1}>
                {t("common.first")}
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
              >
                {t("common.previous")}
              </button>
              <span>
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
              >
                {t("common.next")}
              </button>
              <button type="button" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages}>
                {t("common.last")}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
