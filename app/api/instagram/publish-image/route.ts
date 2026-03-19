import { NextRequest, NextResponse } from "next/server";

const ALLOWED_UPSTREAM_HOST_SUFFIXES = [".fal.media"];

function getSourceUrl(request: NextRequest): URL {
  const src = request.nextUrl.searchParams.get("src");
  if (!src) {
    throw new Error("src is required");
  }

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    throw new Error("Invalid src URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Unsupported src protocol");
  }

  const host = url.host.toLowerCase();
  const allowed = ALLOWED_UPSTREAM_HOST_SUFFIXES.some((suffix) =>
    host.endsWith(suffix)
  );

  if (!allowed) {
    throw new Error("Unsupported src host");
  }

  return url;
}

async function fetchUpstream(
  request: NextRequest,
  method: "GET" | "HEAD"
): Promise<NextResponse> {
  try {
    const sourceUrl = getSourceUrl(request);
    const upstream = await fetch(sourceUrl, {
      method,
      headers: {
        Accept: "image/jpeg,image/*;q=0.9,*/*;q=0.1",
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Failed to fetch upstream image: ${upstream.status}` },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || "image/jpeg"
    );
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Robots-Tag", "noindex");

    return new NextResponse(method === "HEAD" ? null : upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  return fetchUpstream(request, "GET");
}

export async function HEAD(request: NextRequest) {
  return fetchUpstream(request, "HEAD");
}
