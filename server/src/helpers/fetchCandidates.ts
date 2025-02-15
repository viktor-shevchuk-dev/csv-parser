import { fetchWithThrottling, CandidatesToCsvTransform, getUrl } from "./";
import { requestConfig } from "../config";

export async function* fetchCandidates() {
  for (let page = 1; page <= Number.MAX_SAFE_INTEGER; page++) {
    const data = await fetchWithThrottling(getUrl(page), requestConfig);
    yield data;

    if (CandidatesToCsvTransform.isLastPageProcessed) break;
  }
}
