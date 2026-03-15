import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "run-due-tasks",
  { minutes: 1 },
  internal.taskRunner.checkDueTasks
);

crons.interval(
  "run-due-posts",
  { minutes: 1 },
  internal.taskRunner.checkDuePosts
);

export default crons;
