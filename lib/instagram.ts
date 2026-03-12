import { getConvexClient } from "./convex-client";
import { api } from "@/convex/_generated/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InstagramAuth {
  accessToken: string;
  tokenExpiresAt: string;
  igUserId: string;
  username: string;
  profilePictureUrl: string;
  connectedAt: string;
}

export interface InstagramAccount {
  connected: boolean;
  username?: string;
  profilePictureUrl?: string;
  igUserId?: string;
  tokenExpiresAt?: string;
  tokenDaysRemaining?: number;
}

interface ContainerStatus {
  statusCode: "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED";
  errorMessage?: string;
}

export interface PublishResult {
  success: boolean;
  igPostId?: string;
  permalink?: string;
  error?: string;
  retryable?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
const CONTAINER_POLL_INTERVAL_MS = 2000;
const CONTAINER_POLL_MAX_ATTEMPTS = 30;
const MAX_IMAGE_SIZE_BYTES = 7.5 * 1024 * 1024; // 7.5MB (under IG's 8MB limit)

// ─── Token Storage ──────────────────────────────────────────────────────────

export async function loadAuth(): Promise<InstagramAuth | null> {
  try {
    const client = getConvexClient();
    const row = await client.query(api.instagramAuth.get);
    return row as InstagramAuth | null;
  } catch (error) {
    console.error("[Instagram] Failed to load auth from Convex:", error);
    return null;
  }
}

export async function saveAuth(auth: InstagramAuth): Promise<void> {
  try {
    const client = getConvexClient();
    await client.mutation(api.instagramAuth.save, {
      accessToken: auth.accessToken,
      tokenExpiresAt: auth.tokenExpiresAt,
      igUserId: auth.igUserId,
      username: auth.username,
      profilePictureUrl: auth.profilePictureUrl,
      connectedAt: auth.connectedAt,
    });
  } catch (error) {
    console.error("[Instagram] Failed to save auth to Convex:", error);
    throw error;
  }
}

export async function deleteAuth(): Promise<void> {
  try {
    const client = getConvexClient();
    await client.mutation(api.instagramAuth.remove);
  } catch (error) {
    console.error("[Instagram] Failed to delete auth from Convex:", error);
  }
}

export function isTokenExpired(auth: InstagramAuth): boolean {
  return new Date(auth.tokenExpiresAt) <= new Date();
}

export function isTokenExpiringSoon(auth: InstagramAuth, days: number = 7): boolean {
  const expiryDate = new Date(auth.tokenExpiresAt);
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + days);
  return expiryDate <= warningDate;
}

export function getTokenDaysRemaining(auth: InstagramAuth): number {
  const now = new Date();
  const expiry = new Date(auth.tokenExpiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// ─── OAuth Helpers ──────────────────────────────────────────────────────────

export function getOAuthUrl(appId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: "instagram_business_basic,instagram_content_publish",
    response_type: "code",
  });
  return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; userId: string }> {
  // Step 1: Exchange code for short-lived token
  const shortLivedRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!shortLivedRes.ok) {
    const err = await shortLivedRes.text();
    throw new Error(`Failed to exchange code for token: ${err}`);
  }

  const shortLived = await shortLivedRes.json();
  const shortToken = shortLived.access_token;
  const userId = String(shortLived.user_id);

  // Step 2: Exchange short-lived for long-lived token
  const longLivedRes = await fetch(
    `https://graph.instagram.com/access_token?` +
      new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: appSecret,
        access_token: shortToken,
      })
  );

  if (!longLivedRes.ok) {
    const err = await longLivedRes.text();
    throw new Error(`Failed to exchange for long-lived token: ${err}`);
  }

  const longLived = await longLivedRes.json();

  return {
    accessToken: longLived.access_token,
    userId,
  };
}

export async function refreshLongLivedToken(currentToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?` +
      new URLSearchParams({
        grant_type: "ig_refresh_token",
        access_token: currentToken,
      })
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to refresh token: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

// ─── Account Info ───────────────────────────────────────────────────────────

export async function fetchAccountInfo(
  userId: string,
  accessToken: string
): Promise<{ username: string; profilePictureUrl: string }> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${userId}?fields=username,profile_picture_url&access_token=${accessToken}`
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch account info: ${err}`);
  }

  const data = await res.json();
  return {
    username: data.username,
    profilePictureUrl: data.profile_picture_url || "",
  };
}

/**
 * Get account status, auto-refreshing token if expiring soon.
 */
export async function getAccountStatus(): Promise<InstagramAccount> {
  const auth = await loadAuth();
  if (!auth) {
    return { connected: false };
  }

  if (isTokenExpired(auth)) {
    return { connected: false };
  }

  // Auto-refresh if expiring within 7 days
  if (isTokenExpiringSoon(auth, 7)) {
    try {
      const refreshed = await refreshLongLivedToken(auth.accessToken);
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + refreshed.expiresIn);

      const updatedAuth: InstagramAuth = {
        ...auth,
        accessToken: refreshed.accessToken,
        tokenExpiresAt: expiresAt.toISOString(),
      };
      await saveAuth(updatedAuth);

      return {
        connected: true,
        username: updatedAuth.username,
        profilePictureUrl: updatedAuth.profilePictureUrl,
        igUserId: updatedAuth.igUserId,
        tokenExpiresAt: updatedAuth.tokenExpiresAt,
        tokenDaysRemaining: getTokenDaysRemaining(updatedAuth),
      };
    } catch (error) {
      console.error("Auto-refresh failed:", error);
      // Continue with existing token if refresh fails
    }
  }

  return {
    connected: true,
    username: auth.username,
    profilePictureUrl: auth.profilePictureUrl,
    igUserId: auth.igUserId,
    tokenExpiresAt: auth.tokenExpiresAt,
    tokenDaysRemaining: getTokenDaysRemaining(auth),
  };
}

// ─── Image Helpers ──────────────────────────────────────────────────────────

/**
 * Check if an image URL is accessible.
 */
export async function verifyImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check image size and optimize if needed.
 * Returns the original URL if under limit, or a new URL after re-uploading optimized version.
 */
export async function optimizeImageIfNeeded(imageUrl: string): Promise<string> {
  // Download the image to check size
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to download image: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length <= MAX_IMAGE_SIZE_BYTES) {
    return imageUrl; // No optimization needed
  }

  // Need to compress — use sharp
  const sharp = (await import("sharp")).default;
  let quality = 90;
  let optimized: Buffer = await sharp(buffer).jpeg({ quality }).toBuffer();

  while (optimized.length > MAX_IMAGE_SIZE_BYTES && quality >= 50) {
    quality -= 10;
    optimized = await sharp(buffer).jpeg({ quality }).toBuffer();
  }

  if (optimized.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image too large even after compression. Please use a smaller image.");
  }

  // Re-upload to fal.ai storage using server-side upload
  const { uploadToFalStorage } = await import("./fal");
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    throw new Error("FAL_KEY not configured");
  }

  const base64 = `data:image/jpeg;base64,${optimized.toString("base64")}`;
  const url = await uploadToFalStorage(base64, apiKey);
  return url;
}

// ─── Container Management ───────────────────────────────────────────────────

async function createMediaContainer(
  igUserId: string,
  accessToken: string,
  params: Record<string, string>
): Promise<string> {
  const url = `${GRAPH_API_BASE}/${igUserId}/media`;
  const body = new URLSearchParams({ ...params, access_token: accessToken });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const message = err?.error?.message || res.statusText;
    throw new Error(`Failed to create container: ${message}`);
  }

  const data = await res.json();
  return data.id;
}

async function pollContainerStatus(
  containerId: string,
  accessToken: string
): Promise<ContainerStatus> {
  for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(
      `${GRAPH_API_BASE}/${containerId}?fields=status_code,status&access_token=${accessToken}`
    );

    if (!res.ok) {
      throw new Error(`Failed to check container status: ${res.statusText}`);
    }

    const data = await res.json();
    const statusCode = data.status_code;

    if (statusCode === "FINISHED") {
      return { statusCode: "FINISHED" };
    }

    if (statusCode === "ERROR") {
      return {
        statusCode: "ERROR",
        errorMessage: data.status || "Container processing failed",
      };
    }

    if (statusCode === "EXPIRED") {
      return {
        statusCode: "EXPIRED",
        errorMessage: "Container expired before publishing",
      };
    }

    // Still IN_PROGRESS, wait and retry
    await new Promise((r) => setTimeout(r, CONTAINER_POLL_INTERVAL_MS));
  }

  throw new Error("Container processing timed out after 60 seconds");
}

async function publishContainer(
  igUserId: string,
  containerId: string,
  accessToken: string
): Promise<string> {
  const res = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const message = err?.error?.message || res.statusText;
    throw new Error(`Failed to publish: ${message}`);
  }

  const data = await res.json();
  return data.id;
}

async function getPermalink(postId: string, accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${postId}?fields=permalink&access_token=${accessToken}`
    );
    if (res.ok) {
      const data = await res.json();
      return data.permalink;
    }
  } catch {
    // Permalink is not critical, don't fail the publish
  }
  return undefined;
}

// ─── Publishing Orchestration ───────────────────────────────────────────────

function buildFullCaption(caption: string, hashtags: string[]): string {
  const hashtagStr = hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ");
  if (!hashtagStr) return caption;
  return `${caption}\n\n${hashtagStr}`;
}

export async function publishSingleImage(params: {
  imageUrl: string;
  caption: string;
  hashtags: string[];
  scheduledTime?: number;
}): Promise<PublishResult> {
  const auth = await loadAuth();
  if (!auth || isTokenExpired(auth)) {
    return { success: false, error: "Not connected to Instagram", retryable: false };
  }

  try {
    // Optimize image if needed
    const optimizedUrl = await optimizeImageIfNeeded(params.imageUrl);

    const fullCaption = buildFullCaption(params.caption, params.hashtags);

    const containerParams: Record<string, string> = {
      image_url: optimizedUrl,
      caption: fullCaption,
    };

    if (params.scheduledTime) {
      containerParams.published = "false";
      containerParams.scheduled_publish_time = String(params.scheduledTime);
    }

    const containerId = await createMediaContainer(auth.igUserId, auth.accessToken, containerParams);

    const status = await pollContainerStatus(containerId, auth.accessToken);
    if (status.statusCode !== "FINISHED") {
      return {
        success: false,
        error: status.errorMessage || "Container processing failed",
        retryable: true,
      };
    }

    if (params.scheduledTime) {
      return { success: true, igPostId: containerId };
    }

    const postId = await publishContainer(auth.igUserId, containerId, auth.accessToken);
    const permalink = await getPermalink(postId, auth.accessToken);

    return { success: true, igPostId: postId, permalink };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const retryable = !message.includes("token") && !message.includes("permission");
    return { success: false, error: message, retryable };
  }
}

export async function publishCarousel(params: {
  imageUrls: string[];
  caption: string;
  hashtags: string[];
  scheduledTime?: number;
}): Promise<PublishResult> {
  const auth = await loadAuth();
  if (!auth || isTokenExpired(auth)) {
    return { success: false, error: "Not connected to Instagram", retryable: false };
  }

  try {
    if (params.imageUrls.length < 2 || params.imageUrls.length > 10) {
      return {
        success: false,
        error: "Carousels require 2-10 images",
        retryable: false,
      };
    }

    // Optimize all images in parallel
    const optimizedUrls = await Promise.all(
      params.imageUrls.map((url) => optimizeImageIfNeeded(url))
    );

    // Create child containers in parallel
    const childContainerIds = await Promise.all(
      optimizedUrls.map((url) =>
        createMediaContainer(auth.igUserId, auth.accessToken, {
          image_url: url,
          is_carousel_item: "true",
        })
      )
    );

    // Poll all child containers
    for (const childId of childContainerIds) {
      const status = await pollContainerStatus(childId, auth.accessToken);
      if (status.statusCode !== "FINISHED") {
        return {
          success: false,
          error: `Image container failed: ${status.errorMessage}`,
          retryable: true,
        };
      }
    }

    const fullCaption = buildFullCaption(params.caption, params.hashtags);

    // Create carousel container
    const carouselParams: Record<string, string> = {
      media_type: "CAROUSEL",
      children: childContainerIds.join(","),
      caption: fullCaption,
    };

    if (params.scheduledTime) {
      carouselParams.published = "false";
      carouselParams.scheduled_publish_time = String(params.scheduledTime);
    }

    const carouselId = await createMediaContainer(auth.igUserId, auth.accessToken, carouselParams);

    const carouselStatus = await pollContainerStatus(carouselId, auth.accessToken);
    if (carouselStatus.statusCode !== "FINISHED") {
      return {
        success: false,
        error: carouselStatus.errorMessage || "Carousel processing failed",
        retryable: true,
      };
    }

    if (params.scheduledTime) {
      return { success: true, igPostId: carouselId };
    }

    const postId = await publishContainer(auth.igUserId, carouselId, auth.accessToken);
    const permalink = await getPermalink(postId, auth.accessToken);

    return { success: true, igPostId: postId, permalink };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const retryable = !message.includes("token") && !message.includes("permission");
    return { success: false, error: message, retryable };
  }
}

export async function publishStory(params: {
  imageUrl: string;
}): Promise<PublishResult> {
  const auth = await loadAuth();
  if (!auth || isTokenExpired(auth)) {
    return { success: false, error: "Not connected to Instagram", retryable: false };
  }

  try {
    const optimizedUrl = await optimizeImageIfNeeded(params.imageUrl);

    const containerId = await createMediaContainer(auth.igUserId, auth.accessToken, {
      image_url: optimizedUrl,
      media_type: "STORIES",
    });

    const status = await pollContainerStatus(containerId, auth.accessToken);
    if (status.statusCode !== "FINISHED") {
      return {
        success: false,
        error: status.errorMessage || "Story processing failed",
        retryable: true,
      };
    }

    const postId = await publishContainer(auth.igUserId, containerId, auth.accessToken);

    return { success: true, igPostId: postId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const retryable = !message.includes("token") && !message.includes("permission");
    return { success: false, error: message, retryable };
  }
}
