import { request, type FullConfig } from "@playwright/test";
import { BASE_URL, waitForReady } from "./helpers";

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await waitForReady();
  const probe = await request.newContext({ baseURL: BASE_URL });
  try {
    const response = await probe.get("/health/ready");
    if (!response.ok()) throw new Error(`就绪检查返回 ${response.status()}`);
  } finally {
    await probe.dispose();
  }

}
