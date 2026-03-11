"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostPlan } from "@/lib/types";
import { updatePostsCache } from "@/lib/store";

export function usePostStore() {
  const rawPosts = useQuery(api.posts.list);
  const saveMutation = useMutation(api.posts.save);
  const removeMutation = useMutation(api.posts.remove);

  // Parse and sort posts from Convex
  const posts: PostPlan[] = useMemo(() => {
    if (!rawPosts) return [];
    return rawPosts
      .map((row: { data: string }) => {
        try {
          return JSON.parse(row.data) as PostPlan;
        } catch {
          return null;
        }
      })
      .filter((p: PostPlan | null): p is PostPlan => p !== null)
      .sort(
        (a: PostPlan, b: PostPlan) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [rawPosts]);

  // Keep localStorage cache in sync for lib/ code that reads synchronously
  useEffect(() => {
    if (rawPosts !== undefined) {
      updatePostsCache(posts);
    }
  }, [posts, rawPosts]);

  const getPost = useCallback(
    (id: string): PostPlan | undefined => {
      return posts.find((p) => p.id === id);
    },
    [posts]
  );

  const updatePost = useCallback(
    (post: PostPlan) => {
      const updated = { ...post, updatedAt: new Date().toISOString() };
      saveMutation({
        postId: updated.id,
        data: JSON.stringify(updated),
      });
    },
    [saveMutation]
  );

  const deletePost = useCallback(
    (id: string) => {
      removeMutation({ postId: id });
    },
    [removeMutation]
  );

  return {
    posts,
    isLoading: rawPosts === undefined,
    getPost,
    updatePost,
    deletePost,
  };
}
