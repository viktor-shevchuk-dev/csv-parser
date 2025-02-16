import { Readable } from "stream";

export const fetchWithErrorHandling = async (
  url: string,
  config: RequestInit
) => {
  const response = await fetch(url, config);
  const { ok, status, body: webStream, headers } = response;

  if (!ok) {
    throw new Error(`HTTP error! status: ${status}`);
  }

  if (!webStream) {
    throw new Error("No response body");
  }

  return { nodeStream: Readable.fromWeb(webStream), headers };
};
