import { NextRequest, NextResponse } from "next/server";
import { readFile, mkdir, access, writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";

const REFERENCE_IMAGES_PATH = "/Users/kons/Documents/Side/Images/<alba_ai0>/Original Training Data set";
const THUMBS_DIR = join(REFERENCE_IMAGES_PATH, ".thumbs");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  let filename = '';
  try {
    const resolvedParams = await params;
    filename = resolvedParams.filename;
    const filePath = join(REFERENCE_IMAGES_PATH, filename);

    // Check for thumbnail request
    const width = request.nextUrl.searchParams.get("w");

    if (width) {
      const w = parseInt(width, 10);
      if (w > 0 && w <= 800) {
        return await serveThumbnail(filePath, filename, w);
      }
    }

    // Serve full-resolution image
    const imageBuffer = await readFile(filePath);
    const contentType = getContentType(filename);

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error) {
    console.error(`Failed to serve image ${filename}:`, error);
    return new NextResponse('Image not found', { status: 404 });
  }
}

async function serveThumbnail(
  originalPath: string,
  filename: string,
  width: number
): Promise<NextResponse> {
  const thumbFilename = `${width}_${filename.replace(/\.(png|jpeg)$/i, '.jpg')}`;
  const thumbPath = join(THUMBS_DIR, thumbFilename);

  // Try serving cached thumbnail first
  try {
    await access(thumbPath);
    const cached = await readFile(thumbPath);
    return new NextResponse(cached, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    // Not cached yet — generate it
  }

  // Generate thumbnail
  const original = await readFile(originalPath);
  const thumbnail = await sharp(original)
    .resize(width, width, { fit: 'cover' })
    .jpeg({ quality: 75 })
    .toBuffer();

  // Cache to disk (fire-and-forget)
  mkdir(THUMBS_DIR, { recursive: true })
    .then(() => writeFile(thumbPath, thumbnail))
    .catch((err) => console.warn('Failed to cache thumbnail:', err));

  return new NextResponse(thumbnail as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const resolvedParams = await params;
    const filename = resolvedParams.filename;

    const data = await request.json();
    const { summary, tags, metadata } = data;

    if (!summary || !tags || !metadata) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const baseName = filename.replace(/\.(png|jpg|jpeg)$/i, '');
    const textFilePath = join(REFERENCE_IMAGES_PATH, `${baseName}.txt`);

    // Build the text file content
    const textContent = `# summary: ${summary}
# tags: ${tags.join(', ')}

---JSON---
${JSON.stringify(metadata, null, 2)}
---END---
`;

    await writeFile(textFilePath, textContent, 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Image metadata updated successfully'
    });
  } catch (error) {
    console.error('Failed to update image metadata:', error);
    return NextResponse.json(
      { error: 'Failed to update image metadata' },
      { status: 500 }
    );
  }
}

function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'image/jpeg';
  }
}
