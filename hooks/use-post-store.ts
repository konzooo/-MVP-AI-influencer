"use client";

import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostPlan } from "@/lib/types";
import { Id } from "@/convex/_generated/dataModel";

/** Convert a Convex post document back to the PostPlan shape used throughout the app. */
function toPostPlan(doc: any): PostPlan & { _id: Id<"posts"> } {
  return {
    ...doc,
    id: doc.externalId,
  };
}

export function usePostStore() {
  const rawPosts = useQuery(api.posts.list) ?? [];
  const saveMutation = useMutation(api.posts.save);
  const removeByExternalIdMutation = useMutation(api.posts.removeByExternalId);

  const posts: (PostPlan & { _id: Id<"posts"> })[] = rawPosts.map(toPostPlan);

  const getPost = useCallback(
    (id: string): PostPlan | undefined => {
      return posts.find((p) => p.id === id);
    },
    [posts]
  );

  const updatePost = useCallback(
    async (post: PostPlan) => {
      const { id, _id, _creationTime, userId, ...rest } = post as any;
      await saveMutation({
        ...rest,
        id: _id as Id<"posts"> | undefined,
        externalId: id,
        updatedAt: new Date().toISOString(),
      });
    },
    [saveMutation]
  );

  const deletePost = useCallback(
    async (id: string) => {
      await removeByExternalIdMutation({ externalId: id });
    },
    [removeByExternalIdMutation]
  );

  // No-op refresh — Convex queries are reactive
  const refresh = useCallback(() => {}, []);

  return {
    posts,
    refresh,
    getPost,
    updatePost,
    deletePost,
  };
}
