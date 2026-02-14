import { fal } from "@fal-ai/client";

interface GenerateImageRequest {
  prompt: string;
  imageUrls: string[];
  imageSize?: string;
  numImages?: number;
  maxImages?: number;
  seed?: number;
  enableSafetyChecker?: boolean;
}

interface GenerateImageResponse {
  images: {
    url: string;
    width?: number;
    height?: number;
    content_type?: string;
  }[];
}

export async function generateWithSeedream(
  req: GenerateImageRequest,
  apiKey: string
): Promise<GenerateImageResponse> {
  fal.config({ credentials: apiKey });

  try {
    const result: any = await fal.subscribe(
      "fal-ai/bytedance/seedream/v4.5/edit",
      {
        input: {
          prompt: req.prompt,
          image_urls: req.imageUrls,
          image_size: req.imageSize || "square_hd",
          num_images: req.numImages || 1,
          max_images: req.maxImages || 1,
          ...(req.seed ? { seed: req.seed } : {}),
          enable_safety_checker: req.enableSafetyChecker ?? true,
        },
        logs: true,
      }
    );

    if (result.images) {
      return result as GenerateImageResponse;
    } else if (result.data?.images) {
      return result.data as GenerateImageResponse;
    }

    throw new Error("No images found in response");
  } catch (error) {
    console.error("[fal.ai] Generation failed:", error);
    if (error instanceof Error) {
      throw new Error(`fal.ai generation error: ${error.message}`);
    }
    throw error;
  }
}

export async function uploadToFalStorage(
  fileData: string,
  apiKey: string
): Promise<string> {
  fal.config({ credentials: apiKey });

  const match = fileData.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    console.error("[fal.ai] Invalid data URI format");
    throw new Error("Invalid data URI");
  }

  const mimeType = match[1];
  const base64 = match[2];

  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    const url = await fal.storage.upload(blob);
    return url;
  } catch (error) {
    console.error("[fal.ai] Upload failed, falling back to data URI:", error);
    return fileData;
  }
}
