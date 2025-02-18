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

  const limitRemaining = Number(headers.get("x-rate-limit-remaining"));
  const limitResetSeconds = Number(headers.get("x-rate-limit-reset"));
  const rateLimit = Number(headers.get("x-rate-limit-limit"));

  return {
    stream: Readable.fromWeb(webStream),
    headers: { limitRemaining, limitResetSeconds, rateLimit },
  };
};
