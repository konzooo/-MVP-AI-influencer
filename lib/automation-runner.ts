import { NextResponse } from "next/server";
import { loadPostsAsync, savePostAsync } from "./store-server";
import {
  claimTaskRunAsync,
  computeNextRunAt,
  loadTasksAsync,
  saveTaskAsync,
} from "./task-store";
import { PostPlan } from "./types";
import { FromScratchInspirationItem, Task } from "./task-types";
import { generatePostImages, runTask } from "./task-runner";
import { canPublishAsync, recordPublishAsync } from "./instagram-rate-limit";

const TASK_POST_STATUS_PRIORITY: Record<PostPlan["status"], number> = {
  generating: 0,
  ready: 1,
  approved: 2,
  draft: 3,
  publishing: 99,
  scheduled: 99,
  posted: 99,
};

function getInternalApiBaseUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  );
}

function getInternalApiUrl(path: string): string {
  return new URL(path, getInternalApiBaseUrl()).toString();
}

async function recordTaskRunnerStatus(task: Task, error: string | null) {
  task.lastRunError = error;
  task.lastRunResultAt = new Date().toISOString();
  await saveTaskAsync(task);
}

async function publishPost(post: PostPlan): Promise<{
  success: boolean;
  igPostId?: string;
  permalink?: string;
  error?: string;
}> {
  const imageUrls = post.generatedImages
    .filter((image) => image.selected)
    .map((image) => image.url);

  if (imageUrls.length === 0) {
    return {
      success: false,
      error: "No selected images are available for publishing.",
    };
  }

  if (!(await canPublishAsync())) {
    return {
      success: false,
      error: "Daily Instagram publish limit reached.",
    };
  }

  const response = await fetch(getInternalApiUrl("/api/instagram/publish"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrls,
      caption: post.caption,
      hashtags: post.hashtags,
      postType: post.postType,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.error) {
    return {
      success: false,
      error: data?.error || `Publish failed with status ${response.status}`,
    };
  }

  await recordPublishAsync();

  return {
    success: true,
    igPostId: data.igPostId,
    permalink: data.permalink,
  };
}

function findDueScheduledPublish(posts: PostPlan[]): PostPlan | null {
  const now = Date.now();

  const candidates = posts
    .filter((post) => {
      if (post.taskId) return false;
      if (post.status !== "scheduled") return false;
      const scheduledFor = post.publishingInfo?.scheduledFor;
      if (!scheduledFor) return false;
      const scheduledAt = new Date(scheduledFor).getTime();
      return !Number.isNaN(scheduledAt) && scheduledAt <= now;
    })
    .sort((a, b) => {
      const aTime = new Date(a.publishingInfo?.scheduledFor || 0).getTime();
      const bTime = new Date(b.publishingInfo?.scheduledFor || 0).getTime();
      return aTime - bTime;
    });

  return candidates[0] ?? null;
}

function findAdvanceableTaskPost(
  posts: PostPlan[],
  tasks: Task[]
): { post: PostPlan; task: Task } | null {
  const runningTasks = new Map(
    tasks
      .filter((task) => task.status === "running")
      .map((task) => [task.id, task] as const)
  );
  const now = Date.now();

  const candidates = posts
    .filter((post) => {
      if (!post.taskId) return false;
      const task = runningTasks.get(post.taskId);
      if (!task) return false;
      if (!(post.status in TASK_POST_STATUS_PRIORITY)) return false;
      if (TASK_POST_STATUS_PRIORITY[post.status] > 3) return false;

      if (post.status === "ready" && post.publishingInfo?.status === "failed") {
        return false;
      }

      if (post.status === "draft" && post.generationError) {
        if ((post.generationRetryCount || 0) >= 3) return false;
        const age = now - new Date(post.updatedAt).getTime();
        if (age < 5 * 60 * 1000) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const priorityDiff =
        TASK_POST_STATUS_PRIORITY[a.status] -
        TASK_POST_STATUS_PRIORITY[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const post = candidates[0];
  if (!post?.taskId) {
    return null;
  }

  const task = runningTasks.get(post.taskId);
  if (!task) {
    return null;
  }

  return { post, task };
}

function getDueTask(tasks: Task[]): Task | null {
  const now = new Date();
  const candidates = tasks
    .filter(
      (task) =>
        task.status === "running" &&
        task.nextRunAt &&
        new Date(task.nextRunAt) <= now
    )
    .sort((a, b) => {
      const aTime = new Date(a.nextRunAt || 0).getTime();
      const bTime = new Date(b.nextRunAt || 0).getTime();
      return aTime - bTime;
    });

  return candidates[0] ?? null;
}

async function processScheduledPublish(post: PostPlan) {
  const publishingPost: PostPlan = {
    ...post,
    status: "publishing",
    publishingInfo: {
      ...post.publishingInfo,
      status: "publishing",
      error: undefined,
    },
  };
  await savePostAsync(publishingPost);

  const result = await publishPost(post);

  if (!result.success) {
    await savePostAsync({
      ...post,
      status: "ready",
      publishingInfo: {
        ...post.publishingInfo,
        status: "failed",
        error: result.error || "Publishing failed",
      },
    });

    return {
      processed: true,
      action: "scheduled_publish_failed",
      postId: post.id,
      error: result.error || "Publishing failed",
    };
  }

  await savePostAsync({
    ...post,
    status: "posted",
    publishingInfo: {
      ...post.publishingInfo,
      status: "published",
      igPostId: result.igPostId,
      permalink: result.permalink,
      publishedAt: new Date().toISOString(),
      error: undefined,
    },
  });

  return {
    processed: true,
    action: "scheduled_published",
    postId: post.id,
  };
}

async function processTaskLinkedPost(post: PostPlan, task: Task) {
  if (
    post.status === "draft" ||
    post.status === "approved" ||
    post.status === "generating"
  ) {
    let styleModeHint: string | undefined;
    if (post.taskItemId) {
      const item = task.inspirationItems.find((entry) => entry.id === post.taskItemId);
      if (item?.type === "from_scratch") {
        const fromScratchItem = item as FromScratchInspirationItem;
        styleModeHint = fromScratchItem.preferredStyleMode || undefined;
      }
    }

    const generationPost: PostPlan = {
      ...post,
      status: "approved",
    };

    const result = await generatePostImages(generationPost, {
      imageSize: task.defaultImageSize,
      styleModeHint,
    });

    const outcomeError =
      generationPost.status === "generating" ? null : result.error;
    await recordTaskRunnerStatus(task, outcomeError);

    return {
      processed: true,
      action: result.success
        ? "task_post_generated"
        : generationPost.status === "generating"
          ? "task_post_generation_partial"
          : "task_post_generation_failed",
      postId: post.id,
      error: outcomeError,
    };
  }

  const publishingPost: PostPlan = {
    ...post,
    status: "publishing",
    publishingInfo: {
      ...post.publishingInfo,
      status: "publishing",
      error: undefined,
    },
  };
  await savePostAsync(publishingPost);

  const result = await publishPost(post);
  if (!result.success) {
    const error = result.error || "Publishing failed";
    await savePostAsync({
      ...post,
      status: "ready",
      publishingInfo: {
        ...post.publishingInfo,
        status: "failed",
        error,
      },
    });
    await recordTaskRunnerStatus(task, error);

    return {
      processed: true,
      action: "task_post_publish_failed",
      postId: post.id,
      error,
    };
  }

  await savePostAsync({
    ...post,
    status: "posted",
    publishingInfo: {
      ...post.publishingInfo,
      status: "published",
      igPostId: result.igPostId,
      permalink: result.permalink,
      publishedAt: new Date().toISOString(),
      error: undefined,
    },
  });
  await recordTaskRunnerStatus(task, null);

  return {
    processed: true,
    action: "task_post_published",
    postId: post.id,
  };
}

async function processDueTask(task: Task) {
  const lastRunAt = new Date().toISOString();
  const nextRunAt = computeNextRunAt(task);
  const claimedTask = await claimTaskRunAsync(task, { lastRunAt, nextRunAt });

  if (!claimedTask) {
    return {
      processed: false,
      action: "task_claim_skipped",
      taskId: task.id,
    };
  }

  const result = await runTask(claimedTask, { skipTaskLock: true });
  return {
    processed: true,
    action: result.success ? "task_started_pipeline" : "task_start_failed",
    taskId: claimedTask.id,
    postId: result.postId,
    error: result.error,
    log: result.log,
  };
}

export async function runAutomationTick() {
  const [posts, tasks] = await Promise.all([loadPostsAsync(), loadTasksAsync()]);

  const scheduledPublish = findDueScheduledPublish(posts);
  if (scheduledPublish) {
    return processScheduledPublish(scheduledPublish);
  }

  const taskPost = findAdvanceableTaskPost(posts, tasks);
  if (taskPost) {
    return processTaskLinkedPost(taskPost.post, taskPost.task);
  }

  const dueTask = getDueTask(tasks);
  if (dueTask) {
    return processDueTask(dueTask);
  }

  return {
    processed: false,
    action: "noop",
  };
}

export async function handleAutomationRunRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runAutomationTick();
  return NextResponse.json(result);
}
