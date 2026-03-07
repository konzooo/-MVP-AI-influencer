"use client";

import { useState, useEffect, useCallback } from "react";
import { PostPlan } from "@/lib/types";
import { loadPosts, savePost, deletePost as deletePostFromStore, loadPostsRemote, savePosts } from "@/lib/store";
import { POSTS_UPDATED_EVENT, dispatchPostsUpdated } from "@/lib/post-events";

export function usePostStore() {
  const [posts, setPosts] = useState<PostPlan[]>([]);

  const refresh = useCallback(() => {
    setPosts(loadPosts());
  }, []);

  // Load on mount: show local immediately, then sync from Supabase
  useEffect(() => {
    refresh();

    // Fetch from Supabase and sync local cache
    loadPostsRemote().then((remote) => {
      if (remote.length > 0) {
        savePosts(remote);
        setPosts(remote);
      }
    }).catch(() => {
      // Supabase unavailable, local data is fine
    });

    const handler = () => refresh();
    window.addEventListener(POSTS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(POSTS_UPDATED_EVENT, handler);
  }, [refresh]);

  const getPost = useCallback(
    (id: string): PostPlan | undefined => {
      return posts.find((p) => p.id === id);
    },
    [posts]
  );

  const updatePost = useCallback((post: PostPlan) => {
    savePost(post); // dispatches POSTS_UPDATED_EVENT internally
  }, []);

  const deletePost = useCallback((id: string) => {
    deletePostFromStore(id); // dispatches POSTS_UPDATED_EVENT internally
  }, []);

  return {
    posts,
    refresh,
    getPost,
    updatePost,
    deletePost,
  };
}
