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
};
