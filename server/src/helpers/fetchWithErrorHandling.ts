import { Readable } from "stream";

export const fetchWithErrorHandling = async (
  url: string,
  config: RequestInit
) => {
  const response = await fetch(url, config);
  const { ok, status, body: webStream, headers } = response;

  if (!ok) {
    if (status === 429) {
      console.error("Rate limit exceeded.");
    }
    throw new Error(`HTTP error! status: ${status}`);
  }

  if (!webStream) {
    throw new Error("No response body");
  }

  return { stream: Readable.fromWeb(webStream), headers };
};
