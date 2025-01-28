import axios, { AxiosRequestConfig } from "axios";

export const fetchWithThrottling = async (
  url: string,
  config: AxiosRequestConfig
): Promise<{ headers: Record<string, any>; data: NodeJS.ReadableStream }> => {
  const response = await axios.get(url, config);
  const { headers, data } = response;

  const limitRemaining = headers["x-rate-limit-remaining"];
  const limitReset = headers["x-rate-limit-reset"];

  if (Number(limitRemaining) <= 1) {
    const waitMs = Number(limitReset) * 1000;
    console.log(`Approaching limit. Waiting for ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return { headers, data };
};
