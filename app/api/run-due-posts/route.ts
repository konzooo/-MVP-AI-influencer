import { handleAutomationRunRequest } from "@/lib/automation-runner";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAutomationRunRequest(request);
}
