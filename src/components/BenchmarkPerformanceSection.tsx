import { useEffect, useMemo, useState } from "react";
import { useJsonContent } from "../hooks/useJsonContent";
import { useLocale } from "../hooks/useLocale";

interface BenchmarkColumn {
  key: string;
  label: string;
}

interface BenchmarkRow {
  group?: string;
  styles?: Record<string, string>;
  model: string;
  [key: string]: string | number | Record<string, string> | undefined;
}

interface BenchmarkTablePayload {
  source: string;
  generatedAt: string;
  columns: BenchmarkColumn[];
  rows: BenchmarkRow[];
}

interface QuestionSubtype {
  id: string;
  label: string;
  shortName: string;
}

interface QuestionCategory {
  id: string;
  label: string;
  subtypes: QuestionSubtype[];
}

interface QuestionSectionPayload {
  categories: QuestionCategory[];
}

interface MetricLeaf {
  key: string;
  metricLabel: string;
}

interface SubtypeSpec {
  shortName: string;
  categoryId: string;
  groupLabel: string;
  metrics: MetricLeaf[];
}

const fallbackPayload: BenchmarkTablePayload = {
  source: "fallback",
  generatedAt: "",
  columns: [
    { key: "elementCer", label: "Element Recognition CER" },
    { key: "techniqueCer", label: "Technique Recognition CER" },
    { key: "sealAcc", label: "Seal Recognition Accuracy" },
    { key: "inscriptionAcc", label: "Inscription Recognition Accuracy" },
  ],
  rows: [
    {
      group: "Fallback",
      model: "Model A",
      elementCer: "0.2806",
      techniqueCer: "0.6935",
      sealAcc: "59.99%",
      inscriptionAcc: "50.30%",
    },
  ],
};

const fallbackQuestionSection: QuestionSectionPayload = {
  categories: [],
};

const subtypeSpecs: SubtypeSpec[] = [
  {
    shortName: "ITT",
    categoryId: "foundational-knowledge",
    groupLabel: "ITT",
    metrics: [{ key: "ittAcc", metricLabel: "Acc" }],
  },
  {
    shortName: "MITT",
    categoryId: "foundational-knowledge",
    groupLabel: "MITT",
    metrics: [{ key: "mittAcc", metricLabel: "Acc" }],
  },
  {
    shortName: "TTI",
    categoryId: "foundational-knowledge",
    groupLabel: "TTI",
    metrics: [{ key: "ttiAcc", metricLabel: "Acc" }],
  },
  {
    shortName: "MHQA",
    categoryId: "foundational-knowledge",
    groupLabel: "MHQA",
    metrics: [
      { key: "mhqaAcc", metricLabel: "Acc" },
      { key: "mhqaCer", metricLabel: "CER" },
    ],
  },
  {
    shortName: "SR",
    categoryId: "visual-content",
    groupLabel: "SR",
    metrics: [
      { key: "sealAcc", metricLabel: "Acc" },
      { key: "sealIou", metricLabel: "IoU" },
    ],
  },
  {
    shortName: "IR",
    categoryId: "visual-content",
    groupLabel: "IR",
    metrics: [
      { key: "inscriptionAcc", metricLabel: "Acc" },
      { key: "inscriptionIou", metricLabel: "IoU" },
      { key: "inscriptionCer", metricLabel: "CER" },
    ],
  },
  {
    shortName: "ER",
    categoryId: "visual-content",
    groupLabel: "ER",
    metrics: [{ key: "elementCer", metricLabel: "CER" }],
  },
  {
    shortName: "TR",
    categoryId: "visual-content",
    groupLabel: "TR",
    metrics: [{ key: "techniqueCer", metricLabel: "CER" }],
  },
  {
    shortName: "VA",
    categoryId: "deep-reasoning",
    groupLabel: "VA",
    metrics: [{ key: "visualAnalysis", metricLabel: "Score" }],
  },
  {
    shortName: "CC",
    categoryId: "deep-reasoning",
    groupLabel: "CC",
    metrics: [{ key: "culturalContext", metricLabel: "Score" }],
  },
  {
    shortName: "PR",
    categoryId: "deep-reasoning",
    groupLabel: "PR",
    metrics: [{ key: "provenanceResearch", metricLabel: "Score" }],
  },
];

export function BenchmarkPerformanceSection() {
  const { t } = useLocale();
  const payload = useJsonContent<BenchmarkTablePayload>("/content/benchmark-table.json", fallbackPayload);
  const questionSection = useJsonContent<QuestionSectionPayload>(
    "/content/question-section.json",
    fallbackQuestionSection,
  );
  const columns = payload.columns || [];
  const rows = payload.rows || [];

  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [activeSubtypeShort, setActiveSubtypeShort] = useState("all");

  const columnByKey = useMemo(() => {
    return new Map(columns.map((column) => [column.key, column]));
  }, [columns]);

  const categories = useMemo(() => {
    const fromQuestionSection = (questionSection.categories || []).map((category) => ({
      id: category.id,
      label: category.label,
      subtypes: (category.subtypes || []).map((subtype) => ({
        shortName: subtype.shortName,
        label: subtype.label,
      })),
    }));

    const fallbackCategories = [
      { id: "foundational-knowledge", label: t("benchmark.foundationalKnowledge") },
      { id: "visual-content", label: t("benchmark.visualContent") },
      { id: "deep-reasoning", label: t("benchmark.deepReasoning") },
    ];

    const base = fromQuestionSection.length
      ? fromQuestionSection
      : fallbackCategories.map((item) => ({ ...item, subtypes: [] as Array<{ shortName: string; label: string }> }));

    return base
      .map((category) => {
        const specs = subtypeSpecs.filter((spec) => spec.categoryId === category.id);
        const translatedCategoryLabel =
          category.id === "foundational-knowledge"
            ? t("benchmark.foundationalKnowledge")
            : category.id === "visual-content"
              ? t("benchmark.visualContent")
              : category.id === "deep-reasoning"
                ? t("benchmark.deepReasoning")
                : category.label;
        const subtypeMap = new Map(category.subtypes.map((subtype) => [subtype.shortName, subtype.label]));
        const availableSubtypes = specs
          .map((spec) => {
            const metrics = spec.metrics.filter((metric) => columnByKey.has(metric.key));
            if (!metrics.length) {
              return null;
            }
            return {
              ...spec,
              metrics,
              label: t(`benchmark.subtypes.${spec.shortName}`, subtypeMap.get(spec.shortName) || spec.shortName),
            };
          })
          .filter((item): item is SubtypeSpec & { label: string } => Boolean(item));
        return {
          id: category.id,
          label: translatedCategoryLabel,
          subtypes: availableSubtypes,
        };
      })
      .filter((category) => category.subtypes.length > 0);
  }, [columnByKey, questionSection.categories, t]);

  useEffect(() => {
    if (!categories.length) {
      return;
    }
    if (!activeCategoryId || !categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(categories[0].id);
      setActiveSubtypeShort("all");
    }
  }, [activeCategoryId, categories]);

  const activeCategory = categories.find((item) => item.id === activeCategoryId) || categories[0];

  useEffect(() => {
    if (!activeCategory) {
      return;
    }
    if (activeSubtypeShort === "all") {
      return;
    }
    if (!activeCategory.subtypes.some((subtype) => subtype.shortName === activeSubtypeShort)) {
      setActiveSubtypeShort("all");
    }
  }, [activeCategory, activeSubtypeShort]);

  const visibleGroups = useMemo(() => {
    if (!activeCategory) {
      return [] as Array<SubtypeSpec & { label: string }>;
    }
    if (activeSubtypeShort === "all") {
      return activeCategory.subtypes;
    }
    return activeCategory.subtypes.filter((subtype) => subtype.shortName === activeSubtypeShort);
  }, [activeCategory, activeSubtypeShort]);

  const flatColumns = useMemo(() => visibleGroups.flatMap((group) => group.metrics), [visibleGroups]);

  return (
    <section className="section-block" id="benchmark-performance">
      <div className="section-head center-head">
        <h2>{t("benchmark.title")}</h2>
      </div>

      <div className="benchmark-filter-row">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`benchmark-filter-btn ${activeCategory?.id === category.id ? "active" : ""}`}
            onClick={() => {
              setActiveCategoryId(category.id);
              setActiveSubtypeShort("all");
            }}
          >
            {category.label}
          </button>
        ))}
      </div>

      {activeCategory && (
        <div className="benchmark-filter-row benchmark-subtype-row">
          <button
            type="button"
            className={`benchmark-filter-btn ${activeSubtypeShort === "all" ? "active" : ""}`}
            onClick={() => setActiveSubtypeShort("all")}
          >
            {t("common.all")}
          </button>
          {activeCategory.subtypes.map((subtype) => (
            <button
              key={`${activeCategory.id}-${subtype.shortName}`}
              type="button"
              className={`benchmark-filter-btn ${activeSubtypeShort === subtype.shortName ? "active" : ""}`}
              onClick={() => setActiveSubtypeShort(subtype.shortName)}
            >
              {subtype.label}
            </button>
          ))}
        </div>
      )}

      <div className="table-card">
        <table className="benchmark-table">
          <thead>
            <tr>
              <th rowSpan={2}>{t("common.model")}</th>
              {visibleGroups.map((group) => (
                <th key={group.shortName} colSpan={group.metrics.length} className="benchmark-group-head">
                  {group.label}
                </th>
              ))}
            </tr>
            <tr>
              {flatColumns.map((column) => (
                <th key={column.key} className="benchmark-col-head">
                  {column.metricLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => (
              <tr key={record.model}>
                <td>{record.model}</td>
                {flatColumns.map((column) => {
                  const color = String(record.styles?.[column.key] || "").toLowerCase();
                  const className = color === "red" ? "benchmark-cell-red" : color === "blue" ? "benchmark-cell-blue" : "";
                  return (
                    <td key={`${record.model}-${column.key}`} className={className}>
                      {String(record[column.key] ?? "-")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
