import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type { ReferenceImage, ReferenceImageMetadata } from "@/lib/types";

const REFERENCE_IMAGES_PATH = "/Users/kons/Documents/Side/Images/<alba_ai0>/Original Training Data set";

export async function GET() {
  try {
    // Read all files in the directory
    const files = await readdir(REFERENCE_IMAGES_PATH);
    
    // Filter for image files
    const imageFiles = files.filter(file => 
      file.match(/\.(png|jpg|jpeg)$/i)
    );

    const referenceImages: ReferenceImage[] = [];

    for (const imageFile of imageFiles) {
      const baseName = imageFile.replace(/\.(png|jpg|jpeg)$/i, '');
      const textFile = `${baseName}.txt`;

      // Check if corresponding text file exists
      if (files.includes(textFile)) {
        try {
          const textContent = await readFile(
            join(REFERENCE_IMAGES_PATH, textFile),
            'utf-8'
          );

          // Parse the text file content
          const lines = textContent.split('\n');
          const summaryLine = lines.find(line => line.startsWith('# summary:'));
          const tagsLine = lines.find(line => line.startsWith('# tags:'));

          // Extract summary and tags
          const summary = summaryLine ? summaryLine.replace('# summary: ', '').trim() : '';
          const tagsString = tagsLine ? tagsLine.replace('# tags: ', '').trim() : '';
          const tags = tagsString ? tagsString.split(', ').map(tag => tag.trim()) : [];

          // Only include images tagged with "face_reference"
          if (!tags.includes('face_reference')) {
            continue;
          }

          // Extract JSON metadata
          const jsonStartIndex = lines.findIndex(line => line === '---JSON---');
          const jsonEndIndex = lines.findIndex(line => line === '---END---');

          let metadata: ReferenceImageMetadata | null = null;
          if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            const jsonLines = lines.slice(jsonStartIndex + 1, jsonEndIndex);
            const jsonString = jsonLines.join('\n');
            try {
              metadata = JSON.parse(jsonString);
            } catch (e) {
              console.warn(`Failed to parse JSON for ${textFile}:`, e);
            }
          }

          const referenceImage: ReferenceImage = {
            id: baseName,
            filename: imageFile,
            imagePath: `/api/reference-images/${imageFile}`,
            thumbnailPath: `/api/reference-images/${imageFile}?w=300`,
            summary,
            tags,
            metadata: metadata || {
              schema_version: "1.0",
              indoor_outdoor: "indoor",
              place: { type: "unknown", detail: "unknown" },
              capture_method: "non_selfie",
              framing: "waist_up",
              expression: { type: "neutral", mouth: "closed", detail: "unknown" },
              time_of_day: "day",
              image_style: { color: "color", detail: "unknown" }
            },
            createdAt: new Date().toISOString(),
            librarySource: "reference",
          };

          referenceImages.push(referenceImage);
        } catch (error) {
          console.warn(`Failed to read text file for ${imageFile}:`, error);
        }
      }
    }

    // Sort by filename for consistent ordering
    referenceImages.sort((a, b) => a.filename.localeCompare(b.filename));

    return NextResponse.json({ 
      images: referenceImages,
      total: referenceImages.length 
    });
    
  } catch (error) {
    console.error("Failed to load reference images:", error);
    return NextResponse.json(
      { error: "Failed to load reference images" },
      { status: 500 }
    );
  }
}
