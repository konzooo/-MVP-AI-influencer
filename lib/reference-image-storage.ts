export type ConvexReferenceImageVariant = "reference" | "thumbnail";

export function buildConvexReferenceImageUrl(
  imageId: string,
  variant: ConvexReferenceImageVariant,
  version?: string
): string {
  const url = new URL(
    `/api/reference-images/convex/${encodeURIComponent(imageId)}`,
    "http://local.reference.image"
  );

  url.searchParams.set("variant", variant);
  if (version) {
    url.searchParams.set("v", version);
  }

  return `${url.pathname}${url.search}`;
}
