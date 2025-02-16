import { fetchWithErrorHandling } from "./fetchWithErrorHandling";

export const fetchWithThrottling = async (url: string, config: RequestInit) => {
  const { headers, nodeStream } = await fetchWithErrorHandling(url, config);

  const limitRemaining = headers.get("x-rate-limit-remaining");
  const limitReset = headers.get("x-rate-limit-reset");

  if (Number(limitRemaining) <= 1) {
    const waitMs = Number(limitReset) * 1000;
    console.log(`Approaching limit. Waiting for ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return nodeStream;
};
