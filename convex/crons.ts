import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run due tasks every minute
crons.interval(
  "run-due-tasks",
  { minutes: 1 },
  internal.taskRunner.runDueTasks
);

export default crons;
