import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT, "docs");
const CONTENT_DIR = path.join(ROOT, "public", "content");
const CASES_DIR = path.join(CONTENT_DIR, "question-cases");
const IMAGE_ID_MAP_PATH = path.join(ROOT, "..", "hf_repo", "mappings", "image_id_map.json");

const HF_BASE_URL = "https://huggingface.co/datasets/g41/KnowCP/resolve/main";
const MUSEUM_EN_MAP = {
  台北故宫博物院: "National Palace Museum, Taipei",
  大都会博物馆: "The Metropolitan Museum of Art",
  克利夫兰艺术博物馆: "Cleveland Museum of Art",
  东京国立博物馆: "Tokyo National Museum",
  印第安纳波利斯艺术博物馆: "Indianapolis Museum of Art",
  斯德哥尔摩远东文物博物馆: "Museum of Far Eastern Antiquities, Stockholm",
  京都国立博物馆: "Kyoto National Museum",
  "佛利尔·赛克勒美术馆": "Freer and Sackler Galleries",
  芝加哥艺术博物馆: "The Art Institute of Chicago",
  耶鲁大学美术馆: "Yale University Art Gallery",
  布鲁克林博物馆: "Brooklyn Museum",
  洛杉矶县立艺术博物馆: "Los Angeles County Museum of Art",
  底特律艺术博物馆: "Detroit Institute of Arts",
  东京艺术大学: "Tokyo University of the Arts",
  私人藏: "Private Collection",
};

function loadImageIdGroups() {
  try {
    if (!fs.existsSync(IMAGE_ID_MAP_PATH)) {
      return {};
    }
    const obj = readJson(IMAGE_ID_MAP_PATH);
    const groups = obj && typeof obj === "object" ? obj.groups : null;
    return groups && typeof groups === "object" ? groups : {};
  } catch {
    return {};
  }
}

const IMAGE_ID_GROUPS = loadImageIdGroups();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(CONTENT_DIR, relativePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toHfUrl(relativePath) {
  const normalized = normalizeImageRelPath(relativePath);
  return `${HF_BASE_URL}/${normalized}`;
}

function normalizeImageRelPath(relativePath) {
  let normalized = String(relativePath || "").replaceAll("\\", "/").trim();
  normalized = normalized.replace(/^\/+/, "");

  if (normalized.startsWith("storage/images/")) {
    normalized = normalized.slice("storage/images/".length);
  }

  if (!normalized.startsWith("images/")) {
    normalized = `images/${normalized}`;
  }

  const parts = normalized.split("/");
  const fileName = parts[parts.length - 1] || "";
  const match = fileName.match(/^(D\d+)(_.+)?$/i);

  if (match) {
    const dId = String(match[1] || "").toUpperCase();
    const rest = match[2] || "";
    const mapped = IMAGE_ID_GROUPS[dId];
    if (mapped) {
      parts[parts.length - 1] = `${mapped}${rest}`;
      normalized = parts.join("/");
    }
  }

  return normalized;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeBBox({ x, y, width, height, imageWidth, imageHeight }) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  const nx = x / imageWidth;
  const ny = y / imageHeight;
  const nw = width / imageWidth;
  const nh = height / imageHeight;

  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nw) || !Number.isFinite(nh)) {
    return null;
  }

  if (nw <= 0 || nh <= 0) {
    return null;
  }

  return {
    abs: { x, y, width, height },
    norm: { x: nx, y: ny, width: nw, height: nh },
  };
}

function splitLevelText(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(/[\/＞>]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getObjectPath(annotation) {
  const level1 = String(annotation.category || "").trim();
  const extra = splitLevelText(annotation.subcategory);
  const levels = [level1, ...extra].filter(Boolean);

  if (levels.length > 1 && levels[0] === levels[1]) {
    return [levels[0], ...levels.slice(2)];
  }
  return levels.slice(0, 3);
}

function getTechniquePath(annotation) {
  const level1 = String(annotation.primary_technique || "").trim();
  const lineStyles = Array.isArray(annotation.line_style)
    ? annotation.line_style.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const textures = Array.isArray(annotation.texture_strokes)
    ? annotation.texture_strokes.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const uniqueDetails = Array.from(new Set([...lineStyles, ...textures].filter(Boolean)));
  const level2 = uniqueDetails[0] || "";
  const level3 = uniqueDetails[1] || "";

  return [level1, level2, level3].filter(Boolean).slice(0, 3);
}

function countRawAnnotations(dataset, key) {
  let total = 0;
  for (const imageBlock of dataset.images || []) {
    total += Array.isArray(imageBlock.annotations?.[key]) ? imageBlock.annotations[key].length : 0;
  }
  return total;
}

function flattenAnnotations(dataset, key, kind, subImageDimMap) {
  const out = [];
  for (const imageBlock of dataset.images || []) {
    const imageMeta = imageBlock.image || {};
    const annotations = imageBlock.annotations?.[key] || [];

    for (const annotation of annotations) {
      let x;
      let y;
      let width;
      let height;

      if (kind === "object") {
        x = Number(annotation.bbox_x);
        y = Number(annotation.bbox_y);
        width = Number(annotation.bbox_width);
        height = Number(annotation.bbox_height);
      } else {
        const x1 = Number(annotation.bbox_x1);
        const y1 = Number(annotation.bbox_y1);
        const x2 = Number(annotation.bbox_x2);
        const y2 = Number(annotation.bbox_y2);
        x = x1;
        y = y1;
        width = x2 - x1;
        height = y2 - y1;
      }

      const subImagePath = annotation.sub_image_path || imageMeta.image_paths?.[0] || "";
      const normalizedSubImagePath = normalizeImageRelPath(subImagePath);
      const dim =
        subImageDimMap.get(subImagePath) ||
        subImageDimMap.get(normalizedSubImagePath) ||
        null;
      const imageWidth = Number((dim && dim.width) || imageMeta.width || 0);
      const imageHeight = Number((dim && dim.height) || imageMeta.height || 0);

      const bbox = normalizeBBox({ x, y, width, height, imageWidth, imageHeight });
      if (!bbox) {
        continue;
      }

      const pathLevels =
        kind === "object" ? getObjectPath(annotation) : kind === "technique" ? getTechniquePath(annotation) : [];

      out.push({
        id: `${kind}-${annotation.id}`,
        annotationId: annotation.id,
        imageId: annotation.image_id || imageMeta.image_id,
        imageUrl: toHfUrl(normalizedSubImagePath),
        subImagePath: normalizedSubImagePath,
        imageWidth,
        imageHeight,
        bbox: bbox.norm,
        bboxAbs: bbox.abs,
        pathLevels,
        meta:
          kind === "seal"
            ? { text: annotation.seal_text || "" }
            : kind === "inscription"
              ? { text: annotation.transcription || "" }
              : kind === "object"
                ? { category: annotation.category || "", subcategory: annotation.subcategory || "" }
                : {
                    primary: annotation.primary_technique || "",
                    lineStyle: Array.isArray(annotation.line_style) ? annotation.line_style : [],
                    textureStrokes: Array.isArray(annotation.texture_strokes) ? annotation.texture_strokes : [],
                  },
      });
    }
  }
  return out;
}

function buildHierarchy(samples) {
  const nodes = new Map();

  function getNode(pathLevels) {
    const key = pathLevels.join(" > ");
    if (!nodes.has(key)) {
      const parentKey = pathLevels.length > 1 ? pathLevels.slice(0, -1).join(" > ") : null;
      nodes.set(key, {
        id: slugify(key),
        key,
        label: pathLevels[pathLevels.length - 1],
        level: pathLevels.length,
        parentKey,
        path: [...pathLevels],
        childrenKeys: new Set(),
        directSampleIds: new Set(),
        sampleIds: new Set(),
      });
    }
    return nodes.get(key);
  }

  for (const sample of samples) {
    if (!sample.pathLevels.length) {
      continue;
    }

    for (let i = 1; i <= sample.pathLevels.length; i += 1) {
      const partial = sample.pathLevels.slice(0, i);
      const node = getNode(partial);
      node.sampleIds.add(sample.id);
      if (i === sample.pathLevels.length) {
        node.directSampleIds.add(sample.id);
      }
      if (node.parentKey && nodes.has(node.parentKey)) {
        nodes.get(node.parentKey).childrenKeys.add(node.key);
      }
    }
  }

  const serializedNodes = Array.from(nodes.values())
    .map((node) => ({
      id: node.id,
      key: node.key,
      label: node.label,
      level: node.level,
      path: node.path,
      parentKey: node.parentKey,
      childKeys: Array.from(node.childrenKeys).sort(),
      count: node.sampleIds.size,
      directCount: node.directSampleIds.size,
      sampleIds: Array.from(node.sampleIds),
      directSampleIds: Array.from(node.directSampleIds),
    }))
    .sort((a, b) => a.path.join("/").localeCompare(b.path.join("/"), "zh-CN"));

  const topLevel = serializedNodes.filter((node) => node.level === 1).map((node) => node.key);

  return {
    topLevel,
    nodes: serializedNodes,
  };
}

function buildDistributionData() {
  const kb = readJson(path.join(DOCS_DIR, "kb", "knowledge_base.json"));
  const seals = readJson(path.join(DOCS_DIR, "annotations", "seals_annotation_applied.json"));
  const inscriptions = readJson(path.join(DOCS_DIR, "annotations", "inscriptions_annotation_applied.json"));
  const objects = readJson(path.join(DOCS_DIR, "annotations", "objects_annotation_applied.json"));
  const techniques = readJson(path.join(DOCS_DIR, "annotations", "technique_annotation_applied.json"));

  const museumMap = new Map();
  const paintingSet = new Set();
  for (const row of kb) {
    paintingSet.add(row.image_id);
    const museum = row.institution || "Unknown";
    if (!museumMap.has(museum)) {
      museumMap.set(museum, new Set());
    }
    museumMap.get(museum).add(row.image_id);
  }

  const collectionDistribution = Array.from(museumMap.entries())
    .map(([museum, imageIds]) => ({
      museum,
      museum_en: MUSEUM_EN_MAP[museum] || museum,
      paintings: imageIds.size,
    }))
    .sort((a, b) => b.paintings - a.paintings || a.museum.localeCompare(b.museum, "zh-CN"));

  const subImageDimMap = buildSubImageDimensionMap();

  const sealSamples = flattenAnnotations(seals, "seal", "seal", subImageDimMap);
  const inscriptionSamples = flattenAnnotations(inscriptions, "inscription", "inscription", subImageDimMap);
  const elementSamples = flattenAnnotations(objects, "object_detection", "object", subImageDimMap);
  const techniqueSamples = flattenAnnotations(techniques, "technique", "technique", subImageDimMap);

  const elementsHierarchy = buildHierarchy(elementSamples);
  const techniquesHierarchy = buildHierarchy(techniqueSamples);

  const datasetTotals = {
    totalPaintings: paintingSet.size,
    sealAnnotations: sealSamples.length,
    inscriptionAnnotations: inscriptionSamples.length,
    elementAnnotations: elementSamples.length,
    techniqueAnnotations: techniqueSamples.length,
  };

  writeJson("annotation-elements.json", {
    generatedAt: new Date().toISOString(),
    mode: "elements",
    hierarchy: elementsHierarchy,
    samples: elementSamples,
  });

  writeJson("annotation-techniques.json", {
    generatedAt: new Date().toISOString(),
    mode: "techniques",
    hierarchy: techniquesHierarchy,
    samples: techniqueSamples,
  });

  writeJson("annotation-seals.json", {
    generatedAt: new Date().toISOString(),
    mode: "seals",
    samples: sealSamples,
  });

  writeJson("annotation-inscriptions.json", {
    generatedAt: new Date().toISOString(),
    mode: "inscriptions",
    samples: inscriptionSamples,
  });

  writeJson("data-distribution.json", {
    collectionDistribution,
    datasetTotals,
    annotationSources: {
      elements: "/content/annotation-elements.json",
      techniques: "/content/annotation-techniques.json",
      seals: "/content/annotation-seals.json",
      inscriptions: "/content/annotation-inscriptions.json",
    },
  });
}

function parseQuestionTypeMd(mdText) {
  const lines = mdText.split(/\r?\n/);
  const categories = [];
  let currentCategory = null;

  for (const line of lines) {
    const topMatch = line.match(/^-\s+(.+)$/);
    if (topMatch) {
      currentCategory = {
        id: slugify(topMatch[1]),
        label: topMatch[1].trim(),
        subtypes: [],
      };
      categories.push(currentCategory);
      continue;
    }

    const subMatch = line.match(/^\s{2}-\s+(.+?)\(([^)]+)\):\s*(.+)$/);
    if (!subMatch || !currentCategory) {
      continue;
    }

    const [, fullName, shortName, sourceText] = subMatch;
    const sourceItems = sourceText
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [abbr, filePath] = part.split(",").map((item) => item.trim());
        return {
          id: abbr,
          label: abbr,
          filePath: filePath.replace(/^page\\/i, "").replaceAll("\\", "/"),
        };
      });

    currentCategory.subtypes.push({
      id: slugify(fullName),
      label: fullName.trim(),
      shortName: shortName.trim(),
      sources: sourceItems,
    });
  }

  return categories;
}

function questionGroupFromRow(row, subImageDimMap) {
  const images = (row.image_paths || []).map((p) => toHfUrl(p));
  let bbox = null;
  let bboxNorm = null;
  if (Array.isArray(row.focus_bbox) && row.focus_bbox.length === 4) {
    const [x1, y1, x2, y2] = row.focus_bbox.map((n) => Number(n));
    bbox = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    const dim = row.focus_sub_image_path
      ? subImageDimMap.get(row.focus_sub_image_path) || subImageDimMap.get(normalizeImageRelPath(row.focus_sub_image_path))
      : null;
    const looksNormalized = [x1, y1, x2, y2].every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
    if (looksNormalized) {
      bboxNorm = {
        x: x1,
        y: y1,
        width: Math.max(0, x2 - x1),
        height: Math.max(0, y2 - y1),
      };
    } else if (dim && dim.width > 0 && dim.height > 0) {
      bboxNorm = {
        x: bbox.x / dim.width,
        y: bbox.y / dim.height,
        width: bbox.width / dim.width,
        height: bbox.height / dim.height,
      };
    }
  }
  return {
    qid: row.qid,
    imageId: row.image_id,
    type: row.type,
    questionNo: row.question_no,
    prompt: row.prompt,
    answer: row.ground_truth,
    images,
    focusImageIndex: Number(row.focus_image_index || 1) - 1,
    focusSubImageUrl: row.focus_sub_image_path ? toHfUrl(row.focus_sub_image_path) : null,
    focusBBox: bbox,
    focusBBoxNorm: bboxNorm,
  };
}

function buildQuestionCasesForSource(sourceId, rows, subImageDimMap) {
  if (sourceId.includes("MHQA")) {
    const groups = new Map();
    for (const row of rows) {
      const step = String(row.question_no || "").toUpperCase();
      if (!["Q2", "Q3", "Q4", "Q5"].includes(step)) {
        continue;
      }
      const groupKey = `${row.image_id}__${row.type}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          mode: "mhqa",
          label: `${row.image_id} (${row.type})`,
          tabs: ["Q2", "Q3", "Q4", "Q5"],
          questionsByTab: {},
        });
      }
      groups.get(groupKey).questionsByTab[step] = questionGroupFromRow(row, subImageDimMap);
    }

    return Array.from(groups.values()).filter((g) => Object.keys(g.questionsByTab).length > 0);
  }

  if (sourceId === "ER_choice") {
    const groups = new Map();

    for (const row of rows) {
      const match = String(row.question_no || "").match(/^(Q\d+_O\d+)_L([123])$/i);
      if (!match) {
        continue;
      }
      const base = match[1].toUpperCase();
      const levelTag = `L${match[2]}`;
      const groupKey = `${row.image_id}__${base}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          mode: "er_choice",
          label: `${row.image_id} ${base}`,
          tabs: [],
          questionsByTab: {},
        });
      }

      const group = groups.get(groupKey);
      if (!group.tabs.includes(levelTag)) {
        group.tabs.push(levelTag);
      }
      group.questionsByTab[levelTag] = questionGroupFromRow(row, subImageDimMap);
    }

    return Array.from(groups.values())
      .map((group) => ({ ...group, tabs: group.tabs.sort() }))
      .filter((g) => g.tabs.length > 0);
  }

  return rows.map((row, index) => ({
    id: `${sourceId}-${index + 1}`,
    mode: "single",
    label: `${row.image_id}-${row.question_no}`,
    tabs: ["Q"],
    questionsByTab: {
      Q: questionGroupFromRow(row, subImageDimMap),
    },
  }));
}

function buildQuestionData() {
  ensureDir(CASES_DIR);
  const md = fs.readFileSync(path.join(DOCS_DIR, "question_type.md"), "utf8");
  const categories = parseQuestionTypeMd(md);

  const fileCache = new Map();
  const subImageDimMap = buildSubImageDimensionMap();
  const sourceManifest = {};

  for (const category of categories) {
    for (const subtype of category.subtypes) {
      let subtypeTotal = 0;

      for (const source of subtype.sources) {
        const sourcePath = path.join(ROOT, source.filePath);
        let rows = fileCache.get(source.filePath);
        if (!rows) {
          rows = readJsonl(sourcePath);
          fileCache.set(source.filePath, rows);
        }

        const filteredRows = rows.filter((row) => String(row.type || "").trim() === source.id);

        const count = filteredRows.length;
        subtypeTotal += count;

        const groups = buildQuestionCasesForSource(source.id, filteredRows, subImageDimMap);
        const caseFile = `${source.id}.json`;
        writeJson(path.join("question-cases", caseFile), {
          sourceId: source.id,
          groupCount: groups.length,
          groups,
        });

        sourceManifest[source.id] = {
          sourceId: source.id,
          label: source.label,
          filePath: `/content/question-cases/${caseFile}`,
          itemCount: count,
          groupCount: groups.length,
        };

        source.count = count;
      }

      subtype.count = subtypeTotal;
    }

    category.count = category.subtypes.reduce((sum, item) => sum + item.count, 0);
  }

  const chart = categories.map((category) => ({
    categoryId: category.id,
    categoryLabel: category.label,
    total: category.count,
    bars: category.subtypes.map((subtype) => ({
      subtypeId: subtype.id,
      subtypeLabel: subtype.label,
      shortName: subtype.shortName,
      count: subtype.count,
    })),
  }));

  writeJson("question-section.json", {
    chart,
    categories: categories.map((category) => ({
      id: category.id,
      label: category.label,
      count: category.count,
      subtypes: category.subtypes.map((subtype) => ({
        id: subtype.id,
        label: subtype.label,
        shortName: subtype.shortName,
        count: subtype.count,
        sources: subtype.sources.map((source) => ({
          id: source.id,
          label: source.label,
          count: source.count,
          caseFile: sourceManifest[source.id]?.filePath || "",
          groupCount: sourceManifest[source.id]?.groupCount || 0,
        })),
      })),
    })),
  });
}

function buildSubImageDimensionMap() {
  const files = [
    path.join(DOCS_DIR, "annotations", "seals_annotation_applied.json"),
    path.join(DOCS_DIR, "annotations", "inscriptions_annotation_applied.json"),
    path.join(DOCS_DIR, "annotations", "objects_annotation_applied.json"),
    path.join(DOCS_DIR, "annotations", "technique_annotation_applied.json"),
  ];
  const map = new Map();
  const opsPath = path.join(ROOT, "..", "image_processed", "ops", "operations.json");
  let opsMap = {};

  if (fs.existsSync(opsPath)) {
    const opsRaw = readJson(opsPath);
    if (opsRaw && typeof opsRaw === "object") {
      opsMap = opsRaw;
    }
  }

  for (const file of files) {
    const data = readJson(file);
    for (const imageBlock of data.images || []) {
      const imageMeta = imageBlock.image || {};
      const width = Number(imageMeta.width || 0);
      const height = Number(imageMeta.height || 0);
      if (!width || !height) {
        continue;
      }
      for (const subImagePath of imageMeta.image_paths || []) {
        const normalized = normalizeImageRelPath(subImagePath);

        const relFromStorage = String(subImagePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
        const relNoStorage = relFromStorage.startsWith("storage/images/")
          ? relFromStorage.slice("storage/images/".length)
          : relFromStorage;

        const opCandidate =
          opsMap[relNoStorage] ||
          opsMap[relFromStorage] ||
          null;
        const outSize =
          opCandidate && typeof opCandidate === "object" && opCandidate.output_size && typeof opCandidate.output_size === "object"
            ? opCandidate.output_size
            : null;
        const opW = Number(outSize && outSize.width);
        const opH = Number(outSize && outSize.height);

        const finalWidth = Number.isFinite(opW) && opW > 0 ? opW : width;
        const finalHeight = Number.isFinite(opH) && opH > 0 ? opH : height;

        if (!map.has(subImagePath)) {
          map.set(subImagePath, { width: finalWidth, height: finalHeight });
        }
        if (!map.has(normalized)) {
          map.set(normalized, { width: finalWidth, height: finalHeight });
        }
      }
    }
  }

  return map;
}

function buildElementGuide() {
  const content = `# Element Update Guide

This document explains how to update all Element-related website data after new element annotations or element questions are added.

## Inputs
- docs/annotations/objects_annotation_applied.json
- docs/questions/by_type/ER_choice.jsonl
- docs/questions/by_type/ER_fillin.jsonl

## Output files
- public/content/annotation-elements.json
- public/content/data-distribution.json
- public/content/question-section.json
- public/content/question-cases/ER_choice.json
- public/content/question-cases/ER_fillin.json

## Rebuild command
- npm run build:content

## Validation checklist
1. Confirm new labels appear in annotation-elements top level and nested levels.
2. Confirm each updated label has both count and directCount.
3. Confirm ER_choice groups expose existing L1/L2/L3 tabs only.
4. Confirm Data Distribution -> Elements total equals total object bbox count.
5. Confirm Question Distribution counts match by_type ER files.

## Notes
- Hierarchy is generated from actual annotation labels. No fixed dictionary is required.
- If a label text format changes, keep separators stable (/ or >), or update parser logic in tools/build_content.mjs.
`;

  fs.writeFileSync(path.join(CONTENT_DIR, "element_update_guide.md"), content, "utf8");
}

function unwrapTextColor(value) {
  let output = value;
  const pattern = /\\textcolor\{[^}]+\}\{([^{}]*)\}/g;
  let changed = true;
  while (changed) {
    changed = false;
    output = output.replace(pattern, (_, inner) => {
      changed = true;
      return inner;
    });
  }
  return output;
}

function normalizeLatexCell(value) {
  return unwrapTextColor(String(value || ""))
    .replace(/\\%/g, "%")
    .replace(/\\_/g, "_")
    .replace(/\\\$/g, "$")
    .replace(/\\\\/g, "")
    .replace(/\{\}/g, "")
    .trim();
}

function buildBenchmarkData() {
  const texPath = path.join(DOCS_DIR, "performance.tex");
  const tex = fs.readFileSync(texPath, "utf8");
  const lines = tex.split(/\r?\n/).map((line) => line.trim());

  const columns = [
    { key: "ittAcc", label: "Image-to-Title Accuracy" },
    { key: "mittAcc", label: "Multi-Image-to-Title Accuracy" },
    { key: "ttiAcc", label: "Title-to-Image Accuracy" },
    { key: "mhqaAcc", label: "Multi-hop QA Accuracy" },
    { key: "mhqaCer", label: "Multi-hop QA CER" },
    { key: "sealAcc", label: "Seal Recognition Accuracy" },
    { key: "sealIou", label: "Seal Recognition IoU" },
    { key: "inscriptionAcc", label: "Inscription Recognition Accuracy" },
    { key: "inscriptionIou", label: "Inscription Recognition IoU" },
    { key: "inscriptionCer", label: "Inscription Recognition CER" },
    { key: "elementCer", label: "Element Recognition CER" },
    { key: "techniqueCer", label: "Technique Recognition CER" },
    { key: "visualAnalysis", label: "Visual Analysis Score" },
    { key: "culturalContext", label: "Cultural Context Score" },
    { key: "provenanceResearch", label: "Provenance Research Score" },
  ];

  const rows = [];
  let currentGroup = "";

  for (const line of lines) {
    if (line.includes("\\multicolumn{16}{c}{\\textit{Closed-source Models}}")) {
      currentGroup = "Closed-source Models";
      continue;
    }
    if (line.includes("\\multicolumn{16}{c}{\\textit{Open-source Models}}")) {
      currentGroup = "Open-source Models";
      continue;
    }
    if (line.includes("\\multicolumn{16}{c}{\\textit{Humans}}")) {
      currentGroup = "Humans";
      continue;
    }

    if (!line.includes("&") || !line.endsWith("\\\\")) {
      continue;
    }
    if (line.startsWith("&") || line.startsWith("\\")) {
      continue;
    }

    const parts = line
      .replace(/\\\\$/, "")
      .split("&")
      .map((cell) => normalizeLatexCell(cell));

    if (parts.length < 16) {
      continue;
    }

    const model = parts[0];
    if (!model || /\bModels\b/i.test(model)) {
      continue;
    }

    rows.push({
      group: currentGroup || "Other",
      model,
      ittAcc: parts[1],
      mittAcc: parts[2],
      ttiAcc: parts[3],
      mhqaAcc: parts[4],
      mhqaCer: parts[5],
      sealAcc: parts[6],
      sealIou: parts[7],
      inscriptionAcc: parts[8],
      inscriptionIou: parts[9],
      inscriptionCer: parts[10],
      elementCer: parts[11],
      techniqueCer: parts[12],
      visualAnalysis: parts[13],
      culturalContext: parts[14],
      provenanceResearch: parts[15],
    });
  }

  writeJson("benchmark-table.json", {
    source: "docs/performance.tex",
    generatedAt: new Date().toISOString(),
    columns,
    rows,
  });
}

function main() {
  ensureDir(CONTENT_DIR);
  ensureDir(CASES_DIR);
  buildDistributionData();
  buildQuestionData();
  buildElementGuide();
  buildBenchmarkData();
  console.log("Content build complete.");
}

main();
