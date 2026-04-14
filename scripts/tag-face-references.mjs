import { readFile } from "fs/promises";
import { basename, extname } from "path";
import { ConvexHttpClient } from "convex/browser";

const FACE_REFERENCE_TAG = "face_reference";

async function loadEnvFile(filePath) {
  const content = await readFile(filePath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    const value = line
      .slice(eqIndex + 1)
      .split(" #")[0]
      .trim()
      .replace(/^"(.*)"$/, "$1");

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const numbers = argv
    .filter((arg) => /^\d+$/.test(arg))
    .map((arg) => String(Number(arg)));

  if (numbers.length === 0) {
    throw new Error("Provide one or more image numbers, e.g. 121 120 119");
  }

  return {
    apply,
    numbers: [...new Set(numbers)],
  };
}

function getNumericTokens(value) {
  return [...value.matchAll(/\d+/g)].map((match) => match[0]);
}

function rowMatchesNumber(row, numbers) {
  const base = basename(row.filename, extname(row.filename));
  const candidates = [...getNumericTokens(base), ...getNumericTokens(row.imageId)]
    .map((token) => String(Number(token)))
    .filter((token) => token !== "NaN");
  return numbers.some((number) => candidates.includes(String(Number(number))));
}

async function main() {
  const { apply, numbers } = parseArgs(process.argv.slice(2));

  await loadEnvFile(".env.local");

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }

  const client = new ConvexHttpClient(convexUrl);
  const rows = await client.query("referenceImages:list");
  const matches = rows.filter((row) => rowMatchesNumber(row, numbers));

  const matchedNumbers = new Set();
  for (const row of matches) {
    for (const number of numbers) {
      if (rowMatchesNumber(row, [number])) {
        matchedNumbers.add(number);
      }
    }
  }

  const missingNumbers = numbers.filter((number) => !matchedNumbers.has(number));

  console.log(`Found ${matches.length} matching image(s) for ${numbers.join(", ")}`);
  for (const row of matches) {
    const alreadyTagged = row.tags.some(
      (tag) => tag.toLowerCase() === FACE_REFERENCE_TAG
    );
    console.log(
      `- ${row.imageId} | ${row.filename} | tags=${row.tags.join(", ") || "(none)"}${
        alreadyTagged ? " | already tagged" : ""
      }`
    );
  }

  if (missingNumbers.length > 0) {
    console.log(`No matches for: ${missingNumbers.join(", ")}`);
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to update tags.");
    return;
  }

  let updatedCount = 0;
  for (const row of matches) {
    const nextTags = Array.from(
      new Set([...row.tags, FACE_REFERENCE_TAG].map((tag) => tag.trim()).filter(Boolean))
    );

    if (nextTags.length === row.tags.length) {
      continue;
    }

    await client.mutation("referenceImages:updateMetadata", {
      imageId: row.imageId,
      summary: row.summary,
      tags: nextTags,
      metadata: row.metadata,
    });
    updatedCount += 1;
  }

  console.log(`Updated ${updatedCount} image(s) with ${FACE_REFERENCE_TAG}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
