import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { LoadableImage } from "./LoadableImage";
import { TranslatedText } from "./TranslatedText";
import { useJsonContent } from "../hooks/useJsonContent";
import { useLocale } from "../hooks/useLocale";
import { resolvePublicUrl } from "../utils/url";

type ExplorerMode = "elements" | "techniques" | "seals" | "inscriptions";

interface DistributionSummary {
  collectionDistribution: Array<{ museum: string; museum_en: string; paintings: number }>;
  datasetTotals: {
    totalPaintings: number;
    sealAnnotations: number;
    inscriptionAnnotations: number;
    elementAnnotations: number;
    techniqueAnnotations: number;
  };
  annotationSources: {
    elements: string;
    techniques: string;
    seals: string;
    inscriptions: string;
  };
}

interface AnnotationSample {
  id: string;
  imageId: string;
  imageUrl: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pathLevels: string[];
}

interface HierarchyNode {
  key: string;
  label: string;
  level: number;
  childKeys: string[];
  sampleIds: string[];
  count: number;
  directCount: number;
}

interface HierarchyPayload {
  hierarchy: {
    topLevel: string[];
    nodes: HierarchyNode[];
  };
  samples: AnnotationSample[];
}

interface FlatPayload {
  samples: AnnotationSample[];
}

interface ViewerState {
  samples: AnnotationSample[];
  index: number;
}

const EMPTY_HIERARCHY: HierarchyPayload = {
  hierarchy: { topLevel: [], nodes: [] },
  samples: [],
};

const EMPTY_FLAT: FlatPayload = { samples: [] };

function CropPreview({ sample, loadingText }: { sample: AnnotationSample; loadingText: string }) {
  const x1 = Math.max(0, Math.min(1, sample.bbox.x));
  const y1 = Math.max(0, Math.min(1, sample.bbox.y));
  const x2 = Math.max(x1, Math.min(1, sample.bbox.x + sample.bbox.width));
  const y2 = Math.max(y1, Math.min(1, sample.bbox.y + sample.bbox.height));

  const x = x1;
  const y = y1;
  const width = Math.max(0.0001, x2 - x1);
  const height = Math.max(0.0001, y2 - y1);
  const previewRatio = 16 / 9;
  const paddingScale = 1.0;

  const bboxW = Math.max(width, 0.0001);
  const bboxH = Math.max(height, 0.0001);

  let cropW;
  let cropH;
  if (bboxW / bboxH >= previewRatio) {
    cropW = Math.min(1, bboxW * paddingScale);
    cropH = Math.min(1, cropW / previewRatio);
  } else {
    cropH = Math.min(1, bboxH * paddingScale);
    cropW = Math.min(1, cropH * previewRatio);
  }

  const centerX = x + bboxW / 2;
  const centerY = y + bboxH / 2;

  let cropX = centerX - cropW / 2;
  let cropY = centerY - cropH / 2;
  cropX = Math.max(0, Math.min(1 - cropW, cropX));
  cropY = Math.max(0, Math.min(1 - cropH, cropY));

  const scaledWidth = 100 / cropW;
  const scaledHeight = 100 / cropH;
  const imgStyle = {
    left: `${-cropX * scaledWidth}%`,
    top: `${-cropY * scaledHeight}%`,
    width: `${scaledWidth}%`,
    height: `${scaledHeight}%`,
  };

  return (
    <div className="annotation-crop-shell">
      <LoadableImage
        src={resolvePublicUrl(sample.imageUrl)}
        alt={sample.imageId}
        wrapperClassName="annotation-crop-loadable"
        style={imgStyle}
        className="annotation-crop-image"
        loading="lazy"
        loadingText={loadingText}
        errorText={loadingText}
      />
    </div>
  );
}

function FullImageViewer({
  viewer,
  onClose,
  onChange,
  loadingText,
  loadingErrorText,
  t,
}: {
  viewer: ViewerState;
  onClose: () => void;
  onChange: (index: number) => void;
  loadingText: string;
  loadingErrorText: string;
  t: (key: string, fallback?: string) => string;
}) {
  const sample = viewer.samples[viewer.index];
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 });
  const [renderedImageSize, setRenderedImageSize] = useState({ width: 0, height: 0 });

  const computeContainSize = (naturalWidth: number, naturalHeight: number) => {
    const viewport = viewportRef.current;
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

  useEffect(() => {
    return undefined;
  }, []);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [viewer.index]);

  if (!sample) {
    return null;
  }

  const clampOffset = (nextOffset: { x: number; y: number }, nextZoom: number) => {
    const viewport = viewportRef.current;
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

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    if (event.cancelable) {
      event.preventDefault();
    }
    const next = event.deltaY < 0 ? zoom * 1.12 : zoom / 1.12;
    const clampedZoom = Math.max(0.6, Math.min(6, next));
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

  const bboxStyle = (() => {
    const x1 = Math.max(0, Math.min(1, sample.bbox.x));
    const y1 = Math.max(0, Math.min(1, sample.bbox.y));
    const x2 = Math.max(x1, Math.min(1, sample.bbox.x + sample.bbox.width));
    const y2 = Math.max(y1, Math.min(1, sample.bbox.y + sample.bbox.height));
    return {
      left: `${x1 * 100}%`,
      top: `${y1 * 100}%`,
      width: `${(x2 - x1) * 100}%`,
      height: `${(y2 - y1) * 100}%`,
    };
  })();

  return (
    <div className="annotation-viewer-embedded" role="presentation">
      <div className="annotation-viewer-dialog annotation-viewer-dialog-embedded">
        <div
          className="annotation-viewer-canvas"
          ref={viewportRef}
          onWheelCapture={handleWheel}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onPointerLeave={stopDragging}
        >
          <div
            className="annotation-viewer-stage"
            style={{
              width: renderedImageSize.width > 0 ? `${renderedImageSize.width}px` : undefined,
              height: renderedImageSize.height > 0 ? `${renderedImageSize.height}px` : undefined,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            }}
          >
            <LoadableImage
              src={resolvePublicUrl(sample.imageUrl)}
              alt={sample.imageId}
              className="annotation-viewer-image"
              draggable={false}
              loading="lazy"
              onLoad={handleImageLoad}
              loadingText={loadingText}
              errorText={loadingErrorText}
            />
            <div className="annotation-viewer-bbox" style={bboxStyle} />
          </div>
        </div>

        <div className="annotation-viewer-toolbar">
          <button
            type="button"
            onClick={() => onChange((viewer.index - 1 + viewer.samples.length) % viewer.samples.length)}
          >
            {t("common.previous")}
          </button>
          <span>
            {viewer.index + 1} / {viewer.samples.length}
          </span>
          <button type="button" onClick={() => onChange((viewer.index + 1) % viewer.samples.length)}>
            {t("common.next")}
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            {t("explorer.resetZoom")}
          </button>
          <button type="button" onClick={onClose}>
            {t("explorer.backToExplorer")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DataDistributionSection() {
  const { locale, t } = useLocale();
  const tagOrder = useJsonContent<Record<string, unknown>>("/content/tag.json", {});
  const summary = useJsonContent<DistributionSummary>("/content/data-distribution.json", {
    collectionDistribution: [],
    datasetTotals: {
      totalPaintings: 0,
      sealAnnotations: 0,
      inscriptionAnnotations: 0,
      elementAnnotations: 0,
      techniqueAnnotations: 0,
    },
    annotationSources: {
      elements: "/content/annotation-elements.json",
      techniques: "/content/annotation-techniques.json",
      seals: "/content/annotation-seals.json",
      inscriptions: "/content/annotation-inscriptions.json",
    },
  });

  const [mode, setMode] = useState<ExplorerMode>("elements");
  const [elementsData, setElementsData] = useState<HierarchyPayload>(EMPTY_HIERARCHY);
  const [techniquesData, setTechniquesData] = useState<HierarchyPayload>(EMPTY_HIERARCHY);
  const [sealsData, setSealsData] = useState<FlatPayload>(EMPTY_FLAT);
  const [inscriptionsData, setInscriptionsData] = useState<FlatPayload>(EMPTY_FLAT);
  const [loadedSources, setLoadedSources] = useState<Record<ExplorerMode, boolean>>({
    elements: false,
    techniques: false,
    seals: false,
    inscriptions: false,
  });
  const [elementsPath, setElementsPath] = useState({ l1: "", l2: "", l3: "" });
  const [techniquesPath, setTechniquesPath] = useState({ l1: "", l2: "", l3: "" });
  const [page, setPage] = useState(1);
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  useEffect(() => {
    setElementsData(EMPTY_HIERARCHY);
    setTechniquesData(EMPTY_HIERARCHY);
    setSealsData(EMPTY_FLAT);
    setInscriptionsData(EMPTY_FLAT);
    setLoadedSources({
      elements: false,
      techniques: false,
      seals: false,
      inscriptions: false,
    });
  }, [
    summary.annotationSources.elements,
    summary.annotationSources.techniques,
    summary.annotationSources.seals,
    summary.annotationSources.inscriptions,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadModeData() {
      try {
        if (mode === "elements" && !loadedSources.elements) {
          const response = await fetch(resolvePublicUrl(summary.annotationSources.elements), {
            cache: "force-cache",
          });
          if (!response.ok) {
            return;
          }
          const parsed = (await response.json()) as HierarchyPayload;
          if (!cancelled) {
            setElementsData(parsed);
            setLoadedSources((prev) => ({ ...prev, elements: true }));
          }
        }

        if (mode === "techniques" && !loadedSources.techniques) {
          const response = await fetch(resolvePublicUrl(summary.annotationSources.techniques), {
            cache: "force-cache",
          });
          if (!response.ok) {
            return;
          }
          const parsed = (await response.json()) as HierarchyPayload;
          if (!cancelled) {
            setTechniquesData(parsed);
            setLoadedSources((prev) => ({ ...prev, techniques: true }));
          }
        }

        if (mode === "seals" && !loadedSources.seals) {
          const response = await fetch(resolvePublicUrl(summary.annotationSources.seals), {
            cache: "force-cache",
          });
          if (!response.ok) {
            return;
          }
          const parsed = (await response.json()) as FlatPayload;
          if (!cancelled) {
            setSealsData(parsed);
            setLoadedSources((prev) => ({ ...prev, seals: true }));
          }
        }

        if (mode === "inscriptions" && !loadedSources.inscriptions) {
          const response = await fetch(resolvePublicUrl(summary.annotationSources.inscriptions), {
            cache: "force-cache",
          });
          if (!response.ok) {
            return;
          }
          const parsed = (await response.json()) as FlatPayload;
          if (!cancelled) {
            setInscriptionsData(parsed);
            setLoadedSources((prev) => ({ ...prev, inscriptions: true }));
          }
        }
      } catch {
        // keep fallback data on transient fetch errors
      }
    }

    loadModeData();

    return () => {
      cancelled = true;
    };
  }, [loadedSources, mode, summary.annotationSources]);

  const collectionChartOption = useMemo(() => {
    const categoryCount = Math.max(summary.collectionDistribution.length, 1);
    const maxLineLen = categoryCount >= 14 ? 12 : categoryCount >= 10 ? 14 : 16;

    const splitByWordsNearTarget = (text: string, target: number) => {
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length <= 1) {
        return null;
      }
      let best = -1;
      let bestDiff = Number.POSITIVE_INFINITY;
      for (let i = 1; i < words.length; i += 1) {
        const left = words.slice(0, i).join(" ").length;
        const diff = Math.abs(left - target);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      }
      return best > 0 ? [words.slice(0, best).join(" "), words.slice(best).join(" ")] : null;
    };

    const formatMuseumLabel = (label: string) => {
      const text = String(label || "").trim();
      if (text.length <= maxLineLen) {
        return text;
      }

      const clipped = text.length > 62 ? `${text.slice(0, 59)}...` : text;

      const twoLines = splitByWordsNearTarget(clipped, Math.floor(clipped.length / 2));
      if (twoLines) {
        const [line1, line2] = twoLines;
        if (Math.max(line1.length, line2.length) <= maxLineLen) {
          return `${line1}\n${line2}`;
        }
      }

      const words = clipped.split(/\s+/).filter(Boolean);
      if (words.length >= 3) {
        const total = words.join(" ").length + 2;
        const target = Math.floor(total / 3);
        let first = 1;
        let second = Math.max(2, Math.floor((words.length * 2) / 3));
        let bestScore = Number.POSITIVE_INFINITY;
        for (let i = 1; i < words.length - 1; i += 1) {
          for (let j = i + 1; j < words.length; j += 1) {
            const a = words.slice(0, i).join(" ");
            const b = words.slice(i, j).join(" ");
            const c = words.slice(j).join(" ");
            const score = Math.max(Math.abs(a.length - target), Math.abs(b.length - target), Math.abs(c.length - target));
            if (score < bestScore) {
              bestScore = score;
              first = i;
              second = j;
            }
          }
        }
        const a = words.slice(0, first).join(" ");
        const b = words.slice(first, second).join(" ");
        const c = words.slice(second).join(" ");
        return `${a}\n${b}\n${c}`;
      }

      const third = Math.ceil(clipped.length / 3);
      return `${clipped.slice(0, third)}\n${clipped.slice(third, third * 2)}\n${clipped.slice(third * 2)}`;
    };

    const grouped = (() => {
      const others = summary.collectionDistribution.filter((item) => Number(item.paintings || 0) < 6);
      const normal = summary.collectionDistribution.filter((item) => Number(item.paintings || 0) >= 6);
      if (!others.length) {
        return normal;
      }
      const othersTotal = others.reduce((sum, item) => sum + Number(item.paintings || 0), 0);
      return [
        ...normal,
        {
          museum: "others",
          museum_en: "others",
          paintings: othersTotal,
          _othersItems: others,
        } as { museum: string; museum_en: string; paintings: number; _othersItems: Array<{ museum: string; museum_en: string; paintings: number }> },
      ];
    })();

    const xLabels = grouped.map((item) => {
      if (item.museum_en === "others") {
        return t("data.others");
      }
      if (locale === "zh") {
        return item.museum || item.museum_en;
      }
      return item.museum_en || item.museum;
    });
    const fullNames = grouped.map((item) => {
      if (item.museum_en === "others") {
        return t("data.others");
      }
      if (locale === "zh") {
        return item.museum || item.museum_en;
      }
      return item.museum_en || item.museum;
    });
    const values = grouped.map((item) => item.paintings);

    return {
      tooltip: {
        trigger: "item",
        formatter: (params: { dataIndex?: number; value?: number }) => {
          const idx = Number(params.dataIndex || 0);
          const full = fullNames[idx] || "Unknown Museum";
          const value = Number(params.value || 0).toLocaleString();
          const row = grouped[idx] as
            | { museum: string; museum_en: string; paintings: number; _othersItems?: Array<{ museum: string; museum_en: string; paintings: number }> }
            | undefined;
          if (row?.museum_en === "others" && Array.isArray(row._othersItems)) {
            const details = row._othersItems
              .map((m) => `${locale === "zh" ? m.museum || m.museum_en : m.museum_en || m.museum}: ${Number(m.paintings || 0).toLocaleString()}`)
              .join("<br/>");
            return `${t("data.others")}<br/>${t("data.paintings")}: ${value}<br/><br/>${details}`;
          }
          const fullName = full === "Unknown Museum" ? t("data.unknownMuseum") : full;
          return `${fullName}<br/>${t("data.paintings")}: ${value}`;
        },
      },
      grid: { left: 72, right: 22, top: 20, bottom: locale === "zh" ? 82 : 56, containLabel: true },
      xAxis: {
        type: "category",
        data: xLabels,
        boundaryGap: true,
        axisLabel: {
          interval: 0,
          rotate: locale === "zh" ? 28 : 0,
          formatter: (value: string) => formatMuseumLabel(value),
          lineHeight: locale === "zh" ? 12 : 14,
          fontSize: locale === "zh" ? 9 : 10,
          margin: 8,
          hideOverlap: true,
        },
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: "value",
        name: t("data.count"),
        nameLocation: "middle",
        nameGap: 46,
      },
      series: [
        {
          type: "bar",
          data: values,
          barMaxWidth: 28,
          itemStyle: {
            color: "#3f7b67",
            borderRadius: [4, 4, 0, 0],
          },
          label: {
            show: true,
            position: "top",
            formatter: (p: { value?: number }) => Number(p.value || 0).toLocaleString(),
            color: "#2b3f39",
            fontSize: 11,
          },
        },
      ],
    };
  }, [locale, summary.collectionDistribution, t]);

  const elementsNodeMap = useMemo(
    () => new Map(elementsData.hierarchy.nodes.map((node) => [node.key, node])),
    [elementsData.hierarchy.nodes],
  );
  const techniquesNodeMap = useMemo(
    () => new Map(techniquesData.hierarchy.nodes.map((node) => [node.key, node])),
    [techniquesData.hierarchy.nodes],
  );
  const elementSampleMap = useMemo(
    () => new Map(elementsData.samples.map((sample) => [sample.id, sample])),
    [elementsData.samples],
  );
  const techniqueSampleMap = useMemo(
    () => new Map(techniquesData.samples.map((sample) => [sample.id, sample])),
    [techniquesData.samples],
  );

  const elementTopLevelOrder = useMemo(() => Object.keys(tagOrder || {}), [tagOrder]);

  const orderedElementsTopLevel = useMemo(() => {
    const rank = new Map(elementTopLevelOrder.map((name, index) => [name, index]));
    return [...elementsData.hierarchy.topLevel].sort((a, b) => {
      const ra = rank.get(a);
      const rb = rank.get(b);
      if (ra !== undefined && rb !== undefined) {
        return ra - rb;
      }
      if (ra !== undefined) {
        return -1;
      }
      if (rb !== undefined) {
        return 1;
      }
      return a.localeCompare(b, "zh-Hans-CN");
    });
  }, [elementTopLevelOrder, elementsData.hierarchy.topLevel]);

  useEffect(() => {
    if (!elementsPath.l1 && orderedElementsTopLevel[0]) {
      setElementsPath({ l1: orderedElementsTopLevel[0], l2: "", l3: "" });
    }
  }, [orderedElementsTopLevel, elementsPath.l1]);

  useEffect(() => {
    if (!techniquesPath.l1 && techniquesData.hierarchy.topLevel[0]) {
      setTechniquesPath({ l1: techniquesData.hierarchy.topLevel[0], l2: "", l3: "" });
    }
  }, [techniquesData.hierarchy.topLevel, techniquesPath.l1]);

  useEffect(() => {
    setPage(1);
  }, [mode, elementsPath, techniquesPath]);

  const hierarchyContext =
    mode === "elements"
      ? {
          data: elementsData,
          nodeMap: elementsNodeMap,
          sampleMap: elementSampleMap,
          path: elementsPath,
          setPath: setElementsPath,
        }
      : mode === "techniques"
        ? {
            data: techniquesData,
            nodeMap: techniquesNodeMap,
            sampleMap: techniqueSampleMap,
            path: techniquesPath,
            setPath: setTechniquesPath,
          }
        : null;

  const level2Keys =
    hierarchyContext && hierarchyContext.path.l1
      ? hierarchyContext.nodeMap.get(hierarchyContext.path.l1)?.childKeys || []
      : [];
  const level3Keys =
    hierarchyContext && hierarchyContext.path.l2
      ? hierarchyContext.nodeMap.get(hierarchyContext.path.l2)?.childKeys || []
      : [];

  const level1Keys = useMemo(() => {
    if (!hierarchyContext) {
      return [];
    }
    if (mode === "elements") {
      return orderedElementsTopLevel;
    }
    return hierarchyContext.data.hierarchy.topLevel;
  }, [hierarchyContext, mode, orderedElementsTopLevel]);

  const selectedNodeKey = hierarchyContext
    ? hierarchyContext.path.l3 || hierarchyContext.path.l2 || hierarchyContext.path.l1
    : "";

  const hierarchicalSamples = useMemo(() => {
    if (!hierarchyContext || !selectedNodeKey) {
      return [];
    }
    const node = hierarchyContext.nodeMap.get(selectedNodeKey);
    if (!node) {
      return [];
    }
    return node.sampleIds
      .map((id) => hierarchyContext.sampleMap.get(id))
      .filter((sample): sample is AnnotationSample => Boolean(sample));
  }, [hierarchyContext, selectedNodeKey]);

  const allModeSamples =
    mode === "elements"
      ? hierarchicalSamples
      : mode === "techniques"
        ? hierarchicalSamples
        : mode === "seals"
          ? sealsData.samples
          : inscriptionsData.samples;

  const pageSize =
    mode === "elements" || mode === "techniques" ? 6 : mode === "seals" ? 18 : 9;
  const totalPages = Math.max(1, Math.ceil(allModeSamples.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageSamples = allModeSamples.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  useEffect(() => {
    const nextStart = clampedPage * pageSize;
    const nextSamples = allModeSamples.slice(nextStart, nextStart + Math.min(pageSize, 6));
    for (const sample of nextSamples) {
      if (!sample?.imageUrl) {
        continue;
      }
      const img = new Image();
      img.decoding = "async";
      img.src = sample.imageUrl;
    }
  }, [allModeSamples, clampedPage, pageSize]);

  const openViewer = (sample: AnnotationSample) => {
    const index = allModeSamples.findIndex((item) => item.id === sample.id);
    if (index < 0) {
      return;
    }
    setViewer({ samples: allModeSamples, index });
  };

  return (
    <section className="section-block" id="distribution">
      <div className="section-head center-head">
        <h2>{t("data.title")}</h2>
      </div>

      <div className="subsection-card">
        <h3 className="subsection-title">{t("data.collectionDistribution")}</h3>
        <div className="collection-chart-wrap">
          <ReactECharts option={collectionChartOption} style={{ height: 268 }} />
        </div>
      </div>

      <div className="subsection-card">
        <h3 className="subsection-title">{t("data.annotationDistribution")}</h3>
        <table className="distribution-table">
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>{t("data.totalPaintings")}</th>
              <th>{t("data.seals")}</th>
              <th>{t("data.inscriptions")}</th>
              <th>{t("data.elements")}</th>
              <th>{t("data.techniques")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{summary.datasetTotals.totalPaintings.toLocaleString()}</td>
              <td>{summary.datasetTotals.sealAnnotations.toLocaleString()}</td>
              <td>{summary.datasetTotals.inscriptionAnnotations.toLocaleString()}</td>
              <td>{summary.datasetTotals.elementAnnotations.toLocaleString()}</td>
              <td>{summary.datasetTotals.techniqueAnnotations.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="annotation-explorer subsection-card">
        {viewer ? (
          <FullImageViewer
            viewer={viewer}
            onClose={() => setViewer(null)}
            onChange={(index) => setViewer((prev) => (prev ? { ...prev, index } : prev))}
            loadingText={t("common.loading")}
            loadingErrorText={t("common.loadFailed")}
            t={t}
          />
        ) : (
          <>
            <div className="explorer-panel">
              <div className="explorer-main">
                <div className="explorer-top-tabs">
                  <button
                    type="button"
                    className={`explorer-main-tab ${mode === "elements" ? "active" : ""}`}
                    onClick={() => setMode("elements")}
                  >
                    {t("data.elements")}
                  </button>
                  <button
                    type="button"
                    className={`explorer-main-tab ${mode === "techniques" ? "active" : ""}`}
                    onClick={() => setMode("techniques")}
                  >
                    {t("data.techniques")}
                  </button>
                  <button
                    type="button"
                    className={`explorer-main-tab ${mode === "seals" ? "active" : ""}`}
                    onClick={() => setMode("seals")}
                  >
                    {t("data.seals")}
                  </button>
                  <button
                    type="button"
                    className={`explorer-main-tab ${mode === "inscriptions" ? "active" : ""}`}
                    onClick={() => setMode("inscriptions")}
                  >
                    {t("data.inscriptions")}
                  </button>
                </div>

                {(mode === "elements" || mode === "techniques") && hierarchyContext && (
                  <div className="hierarchy-rows">
                    <div className="hierarchy-row level-1">
                      {level1Keys.map((key) => {
                        const node = hierarchyContext.nodeMap.get(key);
                        if (!node) {
                          return null;
                        }
                        return (
                          <button
                            type="button"
                            key={key}
                            className={hierarchyContext.path.l1 === key ? "active" : ""}
                            onClick={() => hierarchyContext.setPath({ l1: key, l2: "", l3: "" })}
                          >
                            <TranslatedText text={node.label} /> <span className="hierarchy-count">({node.count})</span>
                          </button>
                        );
                      })}
                    </div>

                    {Boolean(level2Keys.length) && (
                      <div className="hierarchy-row level-2">
                        {level2Keys.map((key) => {
                          const node = hierarchyContext.nodeMap.get(key);
                          if (!node) {
                            return null;
                          }
                          return (
                            <button
                              type="button"
                              key={key}
                              className={hierarchyContext.path.l2 === key ? "active" : ""}
                              onClick={() =>
                                hierarchyContext.setPath((prev) => ({
                                  ...prev,
                                  l2: key,
                                  l3: "",
                                }))
                              }
                            >
                              <TranslatedText text={node.label} /> <span className="hierarchy-count">({node.count})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {Boolean(level3Keys.length) && (
                      <div className="hierarchy-row level-3">
                        {level3Keys.map((key) => {
                          const node = hierarchyContext.nodeMap.get(key);
                          if (!node) {
                            return null;
                          }
                          return (
                            <button
                              type="button"
                              key={key}
                              className={hierarchyContext.path.l3 === key ? "active" : ""}
                              onClick={() =>
                                hierarchyContext.setPath((prev) => ({
                                  ...prev,
                                  l3: key,
                                }))
                              }
                            >
                              <TranslatedText text={node.label} /> <span className="hierarchy-count">({node.count})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className={`annotation-grid mode-${mode}`}>
                  {pageSamples.map((sample) => (
                    <button
                      key={sample.id}
                      className="annotation-sample-card"
                      type="button"
                      onClick={() => openViewer(sample)}
                    >
                      <CropPreview sample={sample} loadingText={t("common.loading")} />
                      <span className="annotation-sample-label">
                        {sample.pathLevels.length ? (
                          sample.pathLevels.map((level, index) => (
                            <Fragment key={`${sample.id}-${level}-${index}`}>
                              <TranslatedText text={level} />
                              {index < sample.pathLevels.length - 1 ? " / " : ""}
                            </Fragment>
                          ))
                        ) : (
                          sample.imageId
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="explorer-footer">
                  <span className="explorer-total">
                    {t("data.imagesInSelection")}: {allModeSamples.length.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
                  </span>
                  <div className="explorer-pagination">
                    <button type="button" onClick={() => setPage(1)} disabled={clampedPage <= 1}>
                      {t("common.first")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={clampedPage <= 1}
                    >
                      {t("common.previous")}
                    </button>
                    <span>
                      {clampedPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={clampedPage >= totalPages}
                    >
                      {t("common.next")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(totalPages)}
                      disabled={clampedPage >= totalPages}
                    >
                      {t("common.last")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
