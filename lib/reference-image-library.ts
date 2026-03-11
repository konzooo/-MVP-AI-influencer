import "server-only";

import { access, mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import { extname, join } from "path";
import sharp from "sharp";
import type {
  ReferenceImage,
  ReferenceImageMetadata,
  ReferenceImageSourceKey,
} from "@/lib/types";

export type ReferenceLibrarySourceKey = Extract<
  ReferenceImageSourceKey,
  "original" | "improved"
>;

export type ReferenceImageVariant = "original" | "reference" | "thumbnail";

interface ReferenceImageSourceConfig {
  key: ReferenceLibrarySourceKey;
  path: string;
}

interface ParsedReferenceMetadataFile {
  summary: string;
  tags: string[];
  metadata: ReferenceImageMetadata;
}

const REFERENCE_LIBRARY_ROOT =
  "/Users/kons/Documents/Side/Images/<alba_ai0>";

const REFERENCE_IMAGE_SOURCES: ReferenceImageSourceConfig[] = [
  {
    key: "original",
    path: join(REFERENCE_LIBRARY_ROOT, "Original Training Data set"),
  },
  {
    key: "improved",
    path: join(REFERENCE_LIBRARY_ROOT, "Improved Set"),
  },
];

const REFERENCE_VARIANTS_DIR = ".reference-variants";
const REFERENCE_VARIANT_MAX_EDGE = 2048;
const THUMBNAIL_WIDTH = 300;

const DEFAULT_REFERENCE_IMAGE_METADATA: ReferenceImageMetadata = {
  schema_version: "1.0",
  indoor_outdoor: "unknown",
  place: { type: "unknown", detail: "unknown" },
  capture_method: "non_selfie",
  framing: "waist_up",
  expression: { type: "neutral", mouth: "closed", detail: "unknown" },
  time_of_day: "unknown",
  image_style: { color: "color", detail: "unknown" },
};

const VALID_INDOOR_OUTDOOR = ["indoor", "outdoor", "unknown"] as const;
const VALID_CAPTURE_METHODS = [
  "mirror_selfie",
  "front_selfie",
  "non_selfie",
] as const;
const VALID_FRAMING = [
  "closeup",
  "chest_up",
  "waist_up",
  "full_body",
] as const;
const VALID_EXPRESSION_TYPES = [
  "smile",
  "neutral",
  "laugh",
  "serious",
  "other",
] as const;
const VALID_EXPRESSION_MOUTHS = ["open", "closed"] as const;
const VALID_TIME_OF_DAY = [
  "day",
  "night",
  "golden_hour",
  "blue_hour",
  "unknown",
] as const;
const VALID_IMAGE_STYLE_COLORS = ["color", "bw"] as const;

function isImageFilename(filename: string): boolean {
  return /\.(png|jpg|jpeg|webp)$/i.test(filename);
}

function getContentType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

function normalizeEnum<T extends string>(
  value: unknown,
  validValues: readonly T[],
  aliases: Record<string, T> = {}
): T | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if ((validValues as readonly string[]).includes(normalized)) {
    return normalized as T;
  }

  return aliases[normalized] ?? null;
}

function normalizeReferenceImageMetadata(
  raw: unknown,
  fileLabel: string
): ReferenceImageMetadata | null {
  if (!raw || typeof raw !== "object") {
    console.warn(`[reference-library] Missing JSON metadata for ${fileLabel}`);
    return null;
  }

  const parsed = raw as Partial<ReferenceImageMetadata>;
  const indoorOutdoor = normalizeEnum(parsed.indoor_outdoor, VALID_INDOOR_OUTDOOR, {
    indoors: "indoor",
    outdoors: "outdoor",
  });
  const captureMethod = normalizeEnum(parsed.capture_method, VALID_CAPTURE_METHODS, {
    selfie: "front_selfie",
    "front selfie": "front_selfie",
    "mirror selfie": "mirror_selfie",
    "non selfie": "non_selfie",
  });
  const framing = normalizeEnum(parsed.framing, VALID_FRAMING, {
    "close_up": "closeup",
    "close-up": "closeup",
    "close up": "closeup",
    "chest-up": "chest_up",
    "chest up": "chest_up",
    "waist-up": "waist_up",
    "waist up": "waist_up",
    "full-body": "full_body",
    "full body": "full_body",
  });
  const expressionType = normalizeEnum(
    parsed.expression?.type,
    VALID_EXPRESSION_TYPES,
    {
      laughing: "laugh",
    }
  );
  const expressionMouth = normalizeEnum(
    parsed.expression?.mouth,
    VALID_EXPRESSION_MOUTHS
  );
  const timeOfDay = normalizeEnum(parsed.time_of_day, VALID_TIME_OF_DAY, {
    goldenhour: "golden_hour",
    "golden-hour": "golden_hour",
    bluehour: "blue_hour",
    "blue-hour": "blue_hour",
  });
  const imageStyleColor = normalizeEnum(
    parsed.image_style?.color,
    VALID_IMAGE_STYLE_COLORS,
    {
      "black-and-white": "bw",
      blackandwhite: "bw",
      grayscale: "bw",
      greyscale: "bw",
    }
  );

  if (
    !indoorOutdoor ||
    !captureMethod ||
    !framing ||
    !expressionType ||
    !expressionMouth ||
    !timeOfDay ||
    !imageStyleColor
  ) {
    console.warn(
      `[reference-library] Invalid enum metadata in ${fileLabel}; skipping entry`
    );
    return null;
  }

  return {
    schema_version:
      typeof parsed.schema_version === "string" && parsed.schema_version.trim()
        ? parsed.schema_version
        : DEFAULT_REFERENCE_IMAGE_METADATA.schema_version,
    indoor_outdoor: indoorOutdoor,
    place: {
      type:
        typeof parsed.place?.type === "string" && parsed.place.type.trim()
          ? parsed.place.type
          : DEFAULT_REFERENCE_IMAGE_METADATA.place.type,
      detail:
        typeof parsed.place?.detail === "string" && parsed.place.detail.trim()
          ? parsed.place.detail
          : DEFAULT_REFERENCE_IMAGE_METADATA.place.detail,
    },
    capture_method: captureMethod,
    framing,
    expression: {
      type: expressionType,
      mouth: expressionMouth,
      detail:
        typeof parsed.expression?.detail === "string" &&
        parsed.expression.detail.trim()
          ? parsed.expression.detail
          : DEFAULT_REFERENCE_IMAGE_METADATA.expression.detail,
    },
    time_of_day: timeOfDay,
    image_style: {
      color: imageStyleColor,
      detail:
        typeof parsed.image_style?.detail === "string" &&
        parsed.image_style.detail.trim()
          ? parsed.image_style.detail
          : DEFAULT_REFERENCE_IMAGE_METADATA.image_style.detail,
    },
  };
}

function parseReferenceMetadataFile(
  textContent: string,
  fileLabel: string
): ParsedReferenceMetadataFile | null {
  const lines = textContent.split(/\r?\n/);
  const summaryLine = lines.find((line) => line.startsWith("# summary:"));
  const tagsLine = lines.find((line) => line.startsWith("# tags:"));

  if (!summaryLine || !tagsLine) {
    console.warn(
      `[reference-library] Missing summary/tags metadata for ${fileLabel}; skipping entry`
    );
    return null;
  }

  const summary = summaryLine.replace(/^# summary:\s*/, "").trim();
  const tags = tagsLine
    .replace(/^# tags:\s*/, "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!summary || tags.length === 0) {
    console.warn(
      `[reference-library] Empty summary/tags metadata for ${fileLabel}; skipping entry`
    );
    return null;
  }

  const jsonStartIndex = lines.findIndex((line) => line === "---JSON---");
  const jsonEndIndex = lines.findIndex((line) => line === "---END---");
  if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex <= jsonStartIndex) {
    console.warn(
      `[reference-library] Missing JSON block in ${fileLabel}; skipping entry`
    );
    return null;
  }

  try {
    const jsonString = lines
      .slice(jsonStartIndex + 1, jsonEndIndex)
      .join("\n");
    const metadata = normalizeReferenceImageMetadata(
      JSON.parse(jsonString),
      fileLabel
    );
    if (!metadata) {
      return null;
    }

    return { summary, tags, metadata };
  } catch (error) {
    console.warn(
      `[reference-library] Failed to parse JSON metadata for ${fileLabel}:`,
      error
    );
    return null;
  }
}

function getReferenceImageSourceConfig(
  sourceKey: ReferenceLibrarySourceKey
): ReferenceImageSourceConfig {
  const source = REFERENCE_IMAGE_SOURCES.find((item) => item.key === sourceKey);
  if (!source) {
    throw new Error(`Unknown reference image source: ${sourceKey}`);
  }
  return source;
}

function getVariantCachePath(
  source: ReferenceImageSourceConfig,
  filename: string,
  variant: Exclude<ReferenceImageVariant, "original">
): string {
  const variantDir = join(source.path, REFERENCE_VARIANTS_DIR, variant);
  return join(
    variantDir,
    `${filename.replace(/\.(png|jpg|jpeg|webp)$/i, "")}.jpg`
  );
}

async function createDerivedVariantBuffer(
  original: Buffer,
  variant: Exclude<ReferenceImageVariant, "original">
): Promise<Buffer> {
  const pipeline = sharp(original).rotate().flatten({ background: "#ffffff" });

  if (variant === "thumbnail") {
    return pipeline
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_WIDTH, { fit: "cover" })
      .jpeg({ quality: 75 })
      .toBuffer();
  }

  return pipeline
    .resize(REFERENCE_VARIANT_MAX_EDGE, REFERENCE_VARIANT_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function readDerivedVariant(
  source: ReferenceImageSourceConfig,
  filename: string,
  variant: Exclude<ReferenceImageVariant, "original">
): Promise<Buffer> {
  const cachePath = getVariantCachePath(source, filename, variant);

  try {
    await access(cachePath);
    return await readFile(cachePath);
  } catch {
    const original = await readFile(join(source.path, filename));
    const derived = await createDerivedVariantBuffer(original, variant);
    await mkdir(join(source.path, REFERENCE_VARIANTS_DIR, variant), {
      recursive: true,
    });
    await writeFile(cachePath, derived);
    return derived;
  }
}

async function loadReferenceImagesFromSource(
  source: ReferenceImageSourceConfig
): Promise<ReferenceImage[]> {
  const files = await readdir(source.path);
  const fileSet = new Set(files);
  const imageFiles = files.filter(isImageFilename).sort();
  const referenceImages: ReferenceImage[] = [];

  for (const imageFile of imageFiles) {
    const baseName = imageFile.replace(/\.(png|jpg|jpeg|webp)$/i, "");
    const textFile = `${baseName}.txt`;
    const imageStats = await stat(join(source.path, imageFile));

    if (!fileSet.has(textFile)) {
      console.warn(
        `[reference-library] Missing metadata file for ${source.key}/${imageFile}; using fallback metadata`
      );
      const originalPath = buildReferenceImageAssetPath(
        source.key,
        imageFile,
        "original"
      );

      referenceImages.push({
        id: baseName,
        sourceKey: source.key,
        filename: imageFile,
        imagePath: originalPath,
        originalPath,
        referencePath: buildReferenceImageAssetPath(
          source.key,
          imageFile,
          "reference"
        ),
        thumbnailPath: buildReferenceImageAssetPath(
          source.key,
          imageFile,
          "thumbnail"
        ),
        summary: "Metadata pending",
        tags: ["face_reference", "metadata_pending"],
        metadata: DEFAULT_REFERENCE_IMAGE_METADATA,
        createdAt: imageStats.mtime.toISOString(),
        librarySource: "reference",
      });
      continue;
    }

    try {
      const textContent = await readFile(join(source.path, textFile), "utf-8");
      const parsed = parseReferenceMetadataFile(
        textContent,
        `${source.key}/${textFile}`
      );
      if (!parsed) {
        continue;
      }

      if (!parsed.tags.includes("face_reference")) {
        continue;
      }

      const originalPath = buildReferenceImageAssetPath(
        source.key,
        imageFile,
        "original"
      );

      referenceImages.push({
        id: baseName,
        sourceKey: source.key,
        filename: imageFile,
        imagePath: originalPath,
        originalPath,
        referencePath: buildReferenceImageAssetPath(
          source.key,
          imageFile,
          "reference"
        ),
        thumbnailPath: buildReferenceImageAssetPath(
          source.key,
          imageFile,
          "thumbnail"
        ),
        summary: parsed.summary,
        tags: parsed.tags,
        metadata: parsed.metadata,
        createdAt: imageStats.mtime.toISOString(),
        librarySource: "reference",
      });
    } catch (error) {
      console.warn(
        `[reference-library] Failed to load ${source.key}/${imageFile}:`,
        error
      );
    }
  }

  return referenceImages;
}

export function isReferenceLibrarySourceKey(
  value: string
): value is ReferenceLibrarySourceKey {
  return REFERENCE_IMAGE_SOURCES.some((source) => source.key === value);
}

export function buildReferenceImageAssetPath(
  sourceKey: ReferenceLibrarySourceKey,
  filename: string,
  variant: ReferenceImageVariant = "original"
): string {
  const basePath = `/api/reference-images/source/${sourceKey}/${encodeURIComponent(
    filename
  )}`;
  return variant === "original" ? basePath : `${basePath}?variant=${variant}`;
}

export async function loadReferenceImages(): Promise<ReferenceImage[]> {
  const images = await Promise.all(
    REFERENCE_IMAGE_SOURCES.map((source) => loadReferenceImagesFromSource(source))
  );

  return images.flat().sort((a, b) => a.filename.localeCompare(b.filename));
}

export async function readReferenceImageAsset(
  sourceKey: ReferenceLibrarySourceKey,
  filename: string,
  searchParams: URLSearchParams
): Promise<{ buffer: Buffer; contentType: string }> {
  const source = getReferenceImageSourceConfig(sourceKey);
  const variant = resolveRequestedVariant(searchParams);

  if (variant === "original") {
    return {
      buffer: await readFile(join(source.path, filename)),
      contentType: getContentType(filename),
    };
  }

  return {
    buffer: await readDerivedVariant(source, filename, variant),
    contentType: "image/jpeg",
  };
}

export async function updateReferenceImageMetadata(
  sourceKey: ReferenceLibrarySourceKey,
  filename: string,
  data: {
    summary?: string;
    tags?: string[];
    metadata?: ReferenceImageMetadata;
  }
): Promise<void> {
  const { summary, tags, metadata } = data;
  if (!summary || !Array.isArray(tags) || tags.length === 0 || !metadata) {
    throw new Error("Missing required fields");
  }

  const normalizedMetadata = normalizeReferenceImageMetadata(
    metadata,
    `${sourceKey}/${filename}`
  );
  if (!normalizedMetadata) {
    throw new Error("Invalid reference image metadata");
  }

  const source = getReferenceImageSourceConfig(sourceKey);
  const baseName = filename.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  const textFilePath = join(source.path, `${baseName}.txt`);

  const textContent = `# image: ${filename}
# summary: ${summary.trim()}
# tags: ${tags.map((tag) => tag.trim()).filter(Boolean).join(", ")}

---JSON---
${JSON.stringify(normalizedMetadata, null, 2)}
---END---
`;

  await writeFile(textFilePath, textContent, "utf-8");
}

export function parseReferenceImageDataUri(
  dataUri: string
): { mimeType: string; buffer: Buffer } | null {
  const match = dataUri.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export async function normalizeImageBufferForReference(
  buffer: Buffer
): Promise<Buffer> {
  return createDerivedVariantBuffer(buffer, "reference");
}

export async function normalizeDataUriForReference(
  dataUri: string
): Promise<string> {
  const parsed = parseReferenceImageDataUri(dataUri);
  if (!parsed) {
    throw new Error("Invalid data URI");
  }

  const normalized = await normalizeImageBufferForReference(parsed.buffer);
  return `data:image/jpeg;base64,${normalized.toString("base64")}`;
}

function resolveRequestedVariant(
  searchParams: URLSearchParams
): ReferenceImageVariant {
  const variant = searchParams.get("variant");
  if (
    variant === "original" ||
    variant === "reference" ||
    variant === "thumbnail"
  ) {
    return variant;
  }

  if (searchParams.has("w")) {
    return "thumbnail";
  }

  return "original";
}
