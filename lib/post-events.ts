export const POSTS_UPDATED_EVENT = "posts-updated";

export function dispatchPostsUpdated(): void {
  if (typeof window === "undefined") return;
  console.log("[post-events] Dispatching POSTS_UPDATED_EVENT");
  window.dispatchEvent(new Event(POSTS_UPDATED_EVENT));
}
