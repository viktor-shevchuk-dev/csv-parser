import { fetchWithErrorHandling } from "./fetchWithErrorHandling";

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const fetchWithThrottling = async (url: string, config: RequestInit) => {
  const { headers, stream } = await fetchWithErrorHandling(url, config);

  const limitRemaining = Number(headers.get("x-rate-limit-remaining"));
  const limitResetSeconds = Number(headers.get("x-rate-limit-reset"));
  const rateLimit = Number(headers.get("x-rate-limit-limit"));

  if (limitRemaining <= 1) {
    const waitMs = limitResetSeconds * 1000;
    console.log(`Approaching limit. Waiting for ${waitMs}ms`);
    await delay(limitResetSeconds);
  }

  return { data: { stream }, headers: { rateLimit } };
};
