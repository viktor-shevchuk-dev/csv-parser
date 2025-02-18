import { fetchWithErrorHandling } from "./fetchWithErrorHandling";

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const fetchWithThrottling = async (
  config: RequestInit,
  ...urls: string[]
) => {
  const responses = await Promise.all(
    urls.map((url) => fetchWithErrorHandling(url, config))
  );

  return responses;

  // if (limitRemaining <= 1) {
  //   const waitMs = limitResetSeconds * 1000;
  //   console.log(`Approaching limit. Waiting for ${waitMs}ms`);
  //   await delay(limitResetSeconds);
  // }
};
