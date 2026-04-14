import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "run-automation",
  { minutes: 1 },
  internal.taskRunner.checkDueTasks
);

export default crons;
