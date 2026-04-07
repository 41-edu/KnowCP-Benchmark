import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT, "docs");
const CONTENT_DIR = path.join(ROOT, "public", "content");
const CASES_DIR = path.join(CONTENT_DIR, "question-cases");
const HF_IMAGES_DIR = path.join(ROOT, "..", "hf_repo", "images");
const ENV_PATH = path.join(DOCS_DIR, ".env");
const TRANSLATION_CACHE_PATH = path.join(DOCS_DIR, "translation_cache.json");
const TRANSLATION_ITEMS_PATH = path.join(CONTENT_DIR, "translation-items.json");
const TRANSLATION_PENDING_PATH = path.join(CONTENT_DIR, "translation-pending.json");
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

function readJsonOrDefault(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }
  try {
    return readJson(filePath);
  } catch {
    return fallbackValue;
  }
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const idx = line.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key, message, encoding = undefined) {
  return crypto.createHmac("sha256", key).update(message, "utf8").digest(encoding);
}

function loadTranslationCache() {
  if (!fs.existsSync(TRANSLATION_CACHE_PATH)) {
    return {};
  }
  try {
    return readJson(TRANSLATION_CACHE_PATH);
  } catch {
    return {};
  }
}

function saveTranslationCache(cache) {
  fs.writeFileSync(TRANSLATION_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

function protectChoiceOptions(text) {
  const lines = String(text || "").split("\n");
  const optionLines = [];
  const protectedLines = lines.map((line) => {
    if (/^[A-D]\.\s/.test(line.trim())) {
      const token = `[[[OPT_${optionLines.length}]]]`;
      optionLines.push({ token, line });
      return token;
    }
    return line;
  });
  return {
    protectedText: protectedLines.join("\n"),
    restore(translated) {
      let output = translated;
      for (const item of optionLines) {
        output = output.split(item.token).join(item.line);
      }
      return output;
    },
  };
}

function hasChinese(text) {
  return /[\u3400-\u9FFF]/.test(String(text || ""));
}

function detectSourceLanguage(text, forcedMode = "auto") {
  const mode = String(forcedMode || "auto").toLowerCase();
  if (mode === "zh" || mode === "en") {
    return mode;
  }

  const raw = String(text || "");
  const chineseCount = (raw.match(/[\u3400-\u9FFF]/g) || []).length;
  const englishCount = (raw.match(/[A-Za-z]/g) || []).length;

  if (chineseCount > 0 && englishCount === 0) {
    return "zh";
  }
  if (englishCount > 0 && chineseCount === 0) {
    return "en";
  }
  if (chineseCount > 0 && englishCount > 0) {
    return chineseCount >= englishCount ? "zh" : "en";
  }

  return "en";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTencentSdkClient(secretId, secretKey, region) {
  try {
    const tencentcloud = require("tencentcloud-sdk-nodejs");
    const TmtClient = tencentcloud?.tmt?.v20180321?.Client;
    if (!TmtClient) {
      return null;
    }
    return new TmtClient({
      credential: {
        secretId,
        secretKey,
      },
      region: region || "ap-guangzhou",
      profile: {
        httpProfile: {
          endpoint: "tmt.tencentcloudapi.com",
        },
      },
    });
  } catch {
    return null;
  }
}

function shouldSkipTranslationText(text) {
  return /IMG/i.test(String(text || ""));
}

async function tencentTextTranslate(client, sourceText, source, target) {
  if (source === target) {
    return sourceText;
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (client.sdkClient) {
      try {
        const rsp = await client.sdkClient.TextTranslate({
          SourceText: sourceText,
          Source: source,
          Target: target,
          ProjectId: 0,
        });
        return rsp?.TargetText || null;
      } catch (error) {
        if (error && error.code === "RequestLimitExceeded") {
          await sleep(500 * (attempt + 1));
          continue;
        }
        const msg = error && error.message ? error.message : String(error || "");
        if (!client._warnedSdkFailure) {
          client._warnedSdkFailure = true;
          console.warn(`[build:content] Tencent SDK translation failed, fallback to signed HTTP: ${msg}`);
        }
      }
    }

    const host = "tmt.tencentcloudapi.com";
    const service = "tmt";
    const action = "TextTranslate";
    const version = "2018-03-21";
    const region = client.region || "ap-guangzhou";
    const endpoint = `https://${host}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const payloadObj = {
      SourceText: sourceText,
      Source: source,
      Target: target,
      ProjectId: 0,
    };
    const payload = JSON.stringify(payloadObj);

  const httpRequestMethod = "POST";
  const canonicalUri = "/";
  const canonicalQueryString = "";
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const hashedRequestPayload = sha256Hex(payload);
  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload,
  ].join("\n");

  const algorithm = "TC3-HMAC-SHA256";
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = sha256Hex(canonicalRequest);
  const stringToSign = [algorithm, String(timestamp), credentialScope, hashedCanonicalRequest].join("\n");

  const secretDate = hmacSha256(`TC3${client.secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = hmacSha256(secretSigning, stringToSign, "hex");

  const authorization = `${algorithm} Credential=${client.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json; charset=utf-8",
        Host: host,
        "X-TC-Action": action,
        "X-TC-Timestamp": String(timestamp),
        "X-TC-Version": version,
        "X-TC-Region": region,
      },
      body: payload,
    });

    if (!response.ok) {
      if (!client._warnedHttpFailure) {
        client._warnedHttpFailure = true;
        console.warn(`[build:content] Tencent HTTP translation failed with status ${response.status}.`);
      }
      await sleep(300 * (attempt + 1));
      continue;
    }

    const data = await response.json();
    if (data?.Response?.Error) {
      if (data.Response.Error.Code === "RequestLimitExceeded") {
        await sleep(500 * (attempt + 1));
        continue;
      }
      if (!client._warnedApiError) {
        client._warnedApiError = true;
        console.warn(`[build:content] Tencent API error: ${data.Response.Error.Code || "Unknown"}`);
      }
      return null;
    }
    return data?.Response?.TargetText || null;
  }

  return null;
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

function readImageSizeFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const buffer = fs.readFileSync(filePath);
  if (!buffer || buffer.length < 24) {
    return null;
  }

  // PNG: width/height are 4-byte big-endian at offsets 16/20
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  // JPEG: parse markers until a SOF segment carries dimensions
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }

      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (!Number.isFinite(segmentLength) || segmentLength < 2) {
        break;
      }

      const isSOF =
        marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3 ||
        marker === 0xc5 || marker === 0xc6 || marker === 0xc7 || marker === 0xc9 ||
        marker === 0xca || marker === 0xcb || marker === 0xcd || marker === 0xce || marker === 0xcf;

      if (isSOF && offset + 8 < buffer.length) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }

      offset += 2 + segmentLength;
    }
  }

  // WEBP (RIFF)
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunkType = buffer.toString("ascii", 12, 16);
    if (chunkType === "VP8X" && buffer.length >= 30) {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }
  }

  return null;
}

function resolveLocalImagePath(normalizedImagePath) {
  const rel = String(normalizedImagePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
  const relNoImages = rel.startsWith("images/") ? rel.slice("images/".length) : rel;
  return path.join(HF_IMAGES_DIR, relNoImages);
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
        const localImagePath = resolveLocalImagePath(normalized);
        const localDim = readImageSizeFromFile(localImagePath);

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

        const finalWidth =
          (localDim && Number(localDim.width)) ||
          (Number.isFinite(opW) && opW > 0 ? opW : 0) ||
          width;
        const finalHeight =
          (localDim && Number(localDim.height)) ||
          (Number.isFinite(opH) && opH > 0 ? opH : 0) ||
          height;

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

function parseLatexCell(value) {
  const raw = String(value || "").trim();
  const colorMatch = raw.match(/^\\textcolor\{([^}]+)\}\{([\s\S]*)\}$/);
  if (!colorMatch) {
    return {
      value: normalizeLatexCell(raw),
      color: null,
    };
  }

  const colorRaw = String(colorMatch[1] || "").trim().toLowerCase();
  const color = colorRaw === "red" || colorRaw === "blue" ? colorRaw : null;
  return {
    value: normalizeLatexCell(colorMatch[2]),
    color,
  };
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
      .map((cell) => parseLatexCell(cell));

    if (parts.length < 16) {
      continue;
    }

    const model = parts[0].value;
    if (!model || /\bModels\b/i.test(model)) {
      continue;
    }

    const styles = {};
    const metricKeys = [
      "ittAcc",
      "mittAcc",
      "ttiAcc",
      "mhqaAcc",
      "mhqaCer",
      "sealAcc",
      "sealIou",
      "inscriptionAcc",
      "inscriptionIou",
      "inscriptionCer",
      "elementCer",
      "techniqueCer",
      "visualAnalysis",
      "culturalContext",
      "provenanceResearch",
    ];

    for (let index = 0; index < metricKeys.length; index += 1) {
      const cell = parts[index + 1];
      if (cell?.color) {
        styles[metricKeys[index]] = cell.color;
      }
    }

    const row = {
      group: currentGroup || "Other",
      model,
      ittAcc: parts[1].value,
      mittAcc: parts[2].value,
      ttiAcc: parts[3].value,
      mhqaAcc: parts[4].value,
      mhqaCer: parts[5].value,
      sealAcc: parts[6].value,
      sealIou: parts[7].value,
      inscriptionAcc: parts[8].value,
      inscriptionIou: parts[9].value,
      inscriptionCer: parts[10].value,
      elementCer: parts[11].value,
      techniqueCer: parts[12].value,
      visualAnalysis: parts[13].value,
      culturalContext: parts[14].value,
      provenanceResearch: parts[15].value,
    };

    if (Object.keys(styles).length) {
      row.styles = styles;
    }

    rows.push(row);
  }

  writeJson("benchmark-table.json", {
    source: "docs/performance.tex",
    generatedAt: new Date().toISOString(),
    columns,
    rows,
  });
}

function collectTranslatableStringsFromDistribution(filePath, collector) {
  // Institutions are already bilingual in data-distribution.json (museum/museum_en)
  // and should not enter translation tasks.
  void filePath;
  void collector;
}

function collectTranslatableStringsFromHierarchy(filePath, collector) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const payload = readJson(filePath);
  for (const node of payload?.hierarchy?.nodes || []) {
    if (node?.label) {
      collector.add(String(node.label));
    }
    for (const p of node?.path || []) {
      collector.add(String(p));
    }
  }
  for (const sample of payload?.samples || []) {
    for (const level of sample?.pathLevels || []) {
      collector.add(String(level));
    }
  }
}

function collectTranslatableStringsFromQuestionSection(filePath, collector) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const payload = readJson(filePath);
  for (const item of payload?.chart || []) {
    if (item?.categoryLabel) {
      collector.add(String(item.categoryLabel));
    }
    for (const bar of item?.bars || []) {
      if (bar?.subtypeLabel) {
        collector.add(String(bar.subtypeLabel));
      }
    }
  }
  for (const category of payload?.categories || []) {
    if (category?.label) {
      collector.add(String(category.label));
    }
    for (const subtype of category?.subtypes || []) {
      if (subtype?.label) {
        collector.add(String(subtype.label));
      }
      for (const source of subtype?.sources || []) {
        if (source?.label) {
          collector.add(String(source.label));
        }
      }
    }
  }
}

function splitCasePromptForTranslation(prompt, type) {
  const text = String(prompt || "");
  const upperType = String(type || "").toUpperCase();

  if (upperType === "ITT" || upperType === "MITT") {
    const lines = text.split("\n");
    return lines.map((line) => ({
      text: line,
      translatable: !/^[A-D]\.\s/.test(line.trim()),
    }));
  }

  if (upperType === "TTI") {
    const match = text.match(/^(.*?已知作品标题为：)(.+?)(。请判断它对应下列四张图中的哪一张？[\s\S]*)$/);
    if (match) {
      return [
        { text: match[1], translatable: true },
        { text: match[2], translatable: false },
        { text: match[3], translatable: true },
      ];
    }
  }

  return [{ text, translatable: true }];
}

function collectTranslatableStringsFromCases(caseDir, collector) {
  if (!fs.existsSync(caseDir)) {
    return;
  }
  const files = fs.readdirSync(caseDir).filter((name) => name.toLowerCase().endsWith(".json"));
  for (const file of files) {
    const payload = readJson(path.join(caseDir, file));
    for (const group of payload?.groups || []) {
      if (group?.label) {
        collector.add(String(group.label));
      }
      for (const question of Object.values(group?.questionsByTab || {})) {
        if (question?.prompt) {
          const segments = splitCasePromptForTranslation(String(question.prompt), String(question.type || ""));
          for (const segment of segments) {
            const part = String(segment.text || "");
            if (!segment.translatable || !part.trim()) {
              continue;
            }
            collector.add(part);
          }
        }
        if (typeof question?.answer === "string") {
          collector.add(String(question.answer));
        }
      }
    }
  }
}

async function buildStaticTranslations() {
  const env = { ...loadDotEnv(ENV_PATH), ...process.env };
  const secretId = env.TENCENT_SECRET_ID || env.TENCENT_ID || "";
  const secretKey = env.TENCENT_SECRET_KEY || env.TENCENT_KEY || "";
  const region = env.TENCENT_REGION || "ap-guangzhou";
  const translateMaxCallsPerRun = Number(env.TRANSLATE_MAX_CALLS_PER_RUN || 7000);
  const translateMinIntervalMs = Number(env.TRANSLATE_MIN_INTERVAL_MS || 260);
  const translateSourceMode = String(env.TRANSLATE_SOURCE_MODE || "auto").toLowerCase();

  const existingRuntime = readJsonOrDefault(path.join(CONTENT_DIR, "runtime-translations.json"), {
    generatedAt: "",
    en: {},
    zh: {},
  });
  const output = {
    generatedAt: new Date().toISOString(),
    en: { ...(existingRuntime?.en || {}) },
    zh: { ...(existingRuntime?.zh || {}) },
  };

  const preferredItemsPath = fs.existsSync(TRANSLATION_PENDING_PATH)
    ? TRANSLATION_PENDING_PATH
    : TRANSLATION_ITEMS_PATH;
  const itemsPayload = readJsonOrDefault(preferredItemsPath, { items: [] });
  const items = Array.isArray(itemsPayload?.items)
    ? itemsPayload.items
        .map((item) => ({
          text: String(item?.text || "").trim(),
          preserveChoiceOptions: Boolean(item?.preserveChoiceOptions),
          source: detectSourceLanguage(String(item?.text || ""), item?.source || translateSourceMode),
        }))
        .filter((item) => Boolean(item.text))
    : [];

  if (!items.length) {
    console.warn("[build:trans] No pending translation items found. Run build:item first.");
  }

  const cache = loadTranslationCache();
  const canTranslate = Boolean(secretId && secretKey);
  const client = {
    secretId,
    secretKey,
    region,
    sdkClient: canTranslate ? createTencentSdkClient(secretId, secretKey, region) : null,
    rateLimited: false,
    warnedRateLimited: false,
  };
  let translatedCount = 0;
  let apiCallCount = 0;
  const unresolvedItems = [];
  const checkpointEvery = 5;

  if (!canTranslate) {
    console.warn("[build:trans] Tencent translation is disabled: missing TENCENT_SECRET_ID/TENCENT_SECRET_KEY (or TENCENT_ID/TENCENT_KEY).");
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const original = String(item.text || "").trim();
    if (!original) {
      continue;
    }

    if (shouldSkipTranslationText(original)) {
      output.en[original] = original;
      output.zh[original] = original;
      continue;
    }

    const sourceLang = item.source || detectSourceLanguage(original, translateSourceMode);
    const toEnSource = sourceLang;
    const toEnTarget = "en";
    const toZhSource = sourceLang;
    const toZhTarget = "zh";

    const protectedItem = item.preserveChoiceOptions ? protectChoiceOptions(original) : null;
    const textForApi = protectedItem ? protectedItem.protectedText : original;

    const enCacheKey = `${toEnSource}->${toEnTarget}::${textForApi}`;
    const zhCacheKey = `${toZhSource}->${toZhTarget}::${textForApi}`;

    const existingEn = output.en?.[original] || null;
    const existingZh = output.zh?.[original] || null;

    let enText = sourceLang === "zh" ? existingEn || cache[enCacheKey] || null : original;
    let zhText = sourceLang === "zh" ? original : existingZh || cache[zhCacheKey] || null;

    if (!enText && canTranslate && apiCallCount < translateMaxCallsPerRun) {
      if (apiCallCount > 0 && translateMinIntervalMs > 0) {
        await sleep(translateMinIntervalMs);
      }
      apiCallCount += 1;
      const translated = await tencentTextTranslate(client, textForApi, toEnSource, toEnTarget);
      if (translated) {
        enText = translated;
        cache[enCacheKey] = translated;
        translatedCount += 1;
      }
    }

    if (!zhText && canTranslate && apiCallCount < translateMaxCallsPerRun) {
      if (apiCallCount > 0 && translateMinIntervalMs > 0) {
        await sleep(translateMinIntervalMs);
      }
      apiCallCount += 1;
      const translated = await tencentTextTranslate(client, textForApi, toZhSource, toZhTarget);
      if (translated) {
        zhText = translated;
        cache[zhCacheKey] = translated;
        translatedCount += 1;
      }
    }

    const restoredEn = protectedItem && enText ? protectedItem.restore(enText) : enText;
    const restoredZh = protectedItem && zhText ? protectedItem.restore(zhText) : zhText;

    output.en[original] = restoredEn || original;
    output.zh[original] = restoredZh || original;

    const doneEn = typeof output.en[original] === "string" && output.en[original].trim() !== "";
    const doneZh = typeof output.zh[original] === "string" && output.zh[original].trim() !== "";
    if (!(doneEn && doneZh)) {
      unresolvedItems.push(item);
    }

    const processed = index + 1;
    if (processed % checkpointEvery === 0) {
      const pendingSnapshot = [...unresolvedItems, ...items.slice(processed)];
      writeJson("runtime-translations.json", output);
      writeJson("translation-pending.json", {
        generatedAt: new Date().toISOString(),
        count: pendingSnapshot.length,
        items: pendingSnapshot,
      });
      console.log(
        `[build:trans] Progress checkpoint: ${processed}/${items.length}, pending=${pendingSnapshot.length}, apiCalls=${apiCallCount}.`,
      );
    }
  }

  saveTranslationCache(cache);
  writeJson("runtime-translations.json", output);
  writeJson("translation-pending.json", {
    generatedAt: new Date().toISOString(),
    count: unresolvedItems.length,
    items: unresolvedItems,
  });
  if (apiCallCount >= translateMaxCallsPerRun) {
    console.warn(`[build:trans] Reached TRANSLATE_MAX_CALLS_PER_RUN=${translateMaxCallsPerRun}. Re-run build:trans to continue incremental translation.`);
  }
  console.log(
    `[build:trans] Runtime translations prepared: ${items.length} input texts, ${translatedCount} successful API translations, ${apiCallCount} API calls, ${unresolvedItems.length} still pending.`,
  );
}

function collectTranslatableItems() {
  const env = { ...loadDotEnv(ENV_PATH), ...process.env };
  const translateSourceMode = String(env.TRANSLATE_SOURCE_MODE || "auto").toLowerCase();
  const collector = new Set();
  collectTranslatableStringsFromHierarchy(path.join(CONTENT_DIR, "annotation-elements.json"), collector);
  collectTranslatableStringsFromHierarchy(path.join(CONTENT_DIR, "annotation-techniques.json"), collector);
  collectTranslatableStringsFromQuestionSection(path.join(CONTENT_DIR, "question-section.json"), collector);
  collectTranslatableStringsFromCases(CASES_DIR, collector);

  const itemMap = new Map();
  for (const text of collector) {
    const key = String(text || "").trim();
    if (!key) {
      continue;
    }
    if (shouldSkipTranslationText(key)) {
      continue;
    }
    itemMap.set(key, {
      text: key,
      preserveChoiceOptions: false,
      source: detectSourceLanguage(key, translateSourceMode),
    });
  }
  return Array.from(itemMap.values());
}

function buildTranslationItemsFile() {
  const items = collectTranslatableItems();
  const existingRuntime = readJsonOrDefault(path.join(CONTENT_DIR, "runtime-translations.json"), {
    en: {},
    zh: {},
  });
  const env = { ...loadDotEnv(ENV_PATH), ...process.env };
  const useCacheForPending = String(env.BUILD_ITEM_USE_CACHE_FOR_PENDING || "0") === "1";
  const cache = useCacheForPending ? loadTranslationCache() : {};

  const pendingItems = items.filter((item) => {
    const text = item.text;
    const hasEn = typeof existingRuntime?.en?.[text] === "string" && existingRuntime.en[text].trim() !== "";
    const hasZh = typeof existingRuntime?.zh?.[text] === "string" && existingRuntime.zh[text].trim() !== "";
    const source = item.source || detectSourceLanguage(text, "auto");
    const enCacheKey = `${source}->en::${text}`;
    const zhCacheKey = `${source}->zh::${text}`;
    const hasEnByCache = useCacheForPending
      ? source === "zh"
        ? typeof cache?.[enCacheKey] === "string" && cache[enCacheKey].trim() !== ""
        : true
      : false;
    const hasZhByCache = useCacheForPending
      ? source === "zh"
        ? true
        : typeof cache?.[zhCacheKey] === "string" && cache[zhCacheKey].trim() !== ""
      : false;

    return !((hasEn || hasEnByCache) && (hasZh || hasZhByCache));
  });

  writeJson("translation-items.json", {
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  });
  writeJson("translation-pending.json", {
    generatedAt: new Date().toISOString(),
    count: pendingItems.length,
    items: pendingItems,
  });
  console.log(
    `[build:item] Translation items prepared: ${items.length} total, ${pendingItems.length} pending (incremental, cacheAware=${useCacheForPending ? "on" : "off"}).`,
  );
}

function buildItemOnly() {
  ensureDir(CONTENT_DIR);
  ensureDir(CASES_DIR);
  buildDistributionData();
  buildQuestionData();
  buildElementGuide();
  buildBenchmarkData();
  buildTranslationItemsFile();
  console.log("[build:item] Content build complete.");
}

async function run() {
  const mode = String(process.argv[2] || "item").toLowerCase();
  if (mode === "item") {
    buildItemOnly();
    return;
  }
  if (mode === "benchmark") {
    ensureDir(CONTENT_DIR);
    buildBenchmarkData();
    console.log("[build:benchmark] Benchmark table build complete.");
    return;
  }
  if (mode === "trans") {
    await buildStaticTranslations();
    return;
  }
  throw new Error(`Unknown mode: ${mode}. Use 'item', 'benchmark' or 'trans'.`);
}

run().catch((error) => {
  console.error("Build failed:", error && error.message ? error.message : error);
  process.exitCode = 1;
});
