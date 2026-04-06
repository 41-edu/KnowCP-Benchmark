import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useJsonContent } from "../hooks/useJsonContent";
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

const fallbackContent: QuestionSectionContent = {
  chart: [],
  categories: [],
};

function formatAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) {
    return "No answer loaded.";
  }
  if (typeof answer === "string") {
    return answer.replace(/\\n/g, "\n");
  }
  if (typeof answer === "number" || typeof answer === "boolean") {
    return String(answer);
  }
  if (Array.isArray(answer)) {
    return answer.map((item) => formatAnswer(item)).join(" / ");
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

export function QuestionDistributionSection() {
  const content = useJsonContent<QuestionSectionContent>("/content/question-section.json", fallbackContent);

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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const questionPanelRef = useRef<HTMLDivElement | null>(null);
  const answerPanelRef = useRef<HTMLDivElement | null>(null);
  const [renderedImageSize, setRenderedImageSize] = useState({ width: 0, height: 0 });

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

    return [...activeGroup.tabs]
      .sort((a, b) => questionStepNo(a) - questionStepNo(b))
      .filter((tab) => questionStepNo(tab) < currentStep)
      .map((tab) => ({ tab, question: activeGroup.questionsByTab[tab] }))
      .filter((item) => Boolean(item.question));
  }, [activeGroup, innerTab]);

  const chartOption = useMemo(() => {
    const xLabels = content.chart.map((item) => item.categoryLabel);
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
          return null;
        }
        const palette = categoryPalette[category.categoryId] || ["#6a7a82"];
        return {
          value: bar.count,
          categoryId: category.categoryId,
          categoryLabel: category.categoryLabel,
          categoryTotal: category.total,
          subtypeLabel: bar.subtypeLabel,
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
            `Category Total: ${total}`,
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
        name: "Number",
        nameLocation: "middle",
        nameGap: 46,
      },
      series,
      grid: { left: 72, right: 22, top: 24, bottom: 45, containLabel: true },
    };
  }, [content.chart]);

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
    event.preventDefault();
    event.stopPropagation();
    const next = event.deltaY < 0 ? zoom * 1.12 : zoom / 1.12;
    const clampedZoom = Math.max(0.6, Math.min(4, next));
    setZoom(clampedZoom);
    setOffset((prev) => clampOffset(prev, clampedZoom));
  };

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

  return (
    <section className="section-block" id="question-distribution">
      <div className="section-head center-head">
        <h2>Question Distribution</h2>
      </div>

      <div className="question-single-block">
        <article className="question-card full-width transparent-card">
          <h3 className="subsection-title">Number</h3>
          <ReactECharts option={chartOption} style={{ height: 340 }} />
        </article>

        <article className="question-card full-width transparent-card">
          <h3 className="subsection-title">Cases</h3>

          <div className="case-tab-row">
            {(content.categories || []).map((category) => (
              <button
                key={category.id}
                className={`case-tab ${activeCategory?.id === category.id ? "active" : ""}`}
                onClick={() => setActiveCategoryId(category.id)}
                type="button"
              >
                {category.label}
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
                {subtype.label}
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
                      style={{
                        width: renderedImageSize.width > 0 ? `${renderedImageSize.width}px` : undefined,
                        height: renderedImageSize.height > 0 ? `${renderedImageSize.height}px` : undefined,
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                      }}
                    >
                      <img
                        ref={imageRef}
                        src={activeImageUrl}
                        alt={activeQuestion.imageId}
                        className="case-image"
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                        onLoad={handleImageLoad}
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
                    </div>
                  </div>

                  <div className="case-image-toolbar">
                    <button
                      type="button"
                      onClick={() => setImageIndex((prev) => Math.max(0, prev - 1))}
                      disabled={imageIndex <= 0}
                    >
                      Previous Image
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
                      Next Image
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoom(1);
                        setOffset({ x: 0, y: 0 });
                      }}
                    >
                      Reset Zoom
                    </button>
                  </div>
                </>
              ) : (
                <p className="empty-hint">No case image available for this entry.</p>
              )}
            </div>

            <div className="case-qa-panel">
              <div className="question-example" ref={questionPanelRef}>
                {mhqaContext.length > 0 && (
                  <div className="mhqa-context-block">
                    <p>
                      <strong>Previous QA Context</strong>
                    </p>
                    {mhqaContext.map((item) => (
                      <div key={item.tab} className="mhqa-context-item">
                        <p>
                          <strong>{item.tab}</strong>
                        </p>
                        <p>{normalizeMultilineText(item.question.prompt)}</p>
                        <p>
                          <strong>Answer:</strong> {formatAnswer(item.question.answer)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p>
                  <strong>Question</strong>
                </p>
                <p className="question-prompt-block">
                  {normalizeMultilineText(activeQuestion?.prompt) || "No question loaded."}
                </p>
              </div>
              <div className="question-example" ref={answerPanelRef}>
                <p>
                  <strong>Answer (ground truth)</strong>
                </p>
                <pre className="answer-text-block">{formatAnswer(activeQuestion?.answer)}</pre>
              </div>
            </div>
          </div>

          <div className="explorer-footer">
            <span className="explorer-total">Total Groups: {groups.length.toLocaleString()}</span>
            <div className="explorer-pagination">
              <button type="button" onClick={() => setPage(1)} disabled={currentPage <= 1}>
                First
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </button>
              <span>
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
              <button type="button" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages}>
                Last
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
