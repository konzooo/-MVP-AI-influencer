import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "./convex-client";
import { getPublicAppBaseUrl } from "./app-url";

export function buildGeneratedImageUrl(
  imageId: string,
  variant: "original" | "publish" = "original"
): string {
  const url = new URL(
    `/api/generated-images/${encodeURIComponent(imageId)}`,
    getPublicAppBaseUrl()
  );

  if (variant !== "original") {
    url.searchParams.set("variant", variant);
  }

  return url.toString();
}

export async function persistGeneratedImageFromFal(params: {
  imageId: string;
  falUrl: string;
  prompt: string;
  postId?: string;
  postTitle?: string;
  promptIndex?: number;
  createdAt: string;
}): Promise<{
  storageId: string;
  url: string;
  sourceUrl: string;
}> {
  const client = getConvexClient();
  const { storageId } = await client.action(api.imageStorage.persistFalImage, {
    falUrl: params.falUrl,
    postId: params.postId,
    prompt: params.prompt,
  });

  await client.mutation(api.generatedImages.add, {
    imageId: params.imageId,
    storageId: storageId as Id<"_storage">,
    prompt: params.prompt,
    postId: params.postId,
    postTitle: params.postTitle,
    promptIndex: params.promptIndex,
    createdAt: params.createdAt,
  });

  return {
    storageId,
    url: buildGeneratedImageUrl(params.imageId),
    sourceUrl: params.falUrl,
  };
}
