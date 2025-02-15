import { Readable } from "stream";

export const fetchWithThrottling = async (
  url: string,
  config: RequestInit
): Promise<NodeJS.ReadableStream> => {
  const response = await fetch(url, config);
  const { ok, status, body, headers } = response;

  if (!ok) {
    throw new Error(`HTTP error! status: ${status}`);
  }

  const webStream = body;
  if (!webStream) {
    throw new Error("No response body");
  }

  const nodeStream = Readable.fromWeb(webStream);

  const limitRemaining = headers.get("x-rate-limit-remaining");
  const limitReset = headers.get("x-rate-limit-reset");

  if (Number(limitRemaining) <= 1) {
    const waitMs = Number(limitReset) * 1000;
    console.log(`Approaching limit. Waiting for ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return nodeStream;
};
