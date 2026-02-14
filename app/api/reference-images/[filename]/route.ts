import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const REFERENCE_IMAGES_PATH = "/Users/kons/Documents/Images/<alba_ai0>/Training Data set";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  let filename = '';
  try {
    const resolvedParams = await params;
    filename = resolvedParams.filename;
    const filePath = join(REFERENCE_IMAGES_PATH, filename);
    
    // Read the image file
    const imageBuffer = await readFile(filePath);
    
    // Determine content type based on file extension
    const ext = filename.toLowerCase().split('.').pop();
    let contentType = 'image/jpeg'; // default
    
    switch (ext) {
      case 'png':
        contentType = 'image/png';
        break;
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'gif':
        contentType = 'image/gif';
        break;
      case 'webp':
        contentType = 'image/webp';
        break;
    }
    
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