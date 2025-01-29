import { fetchWithThrottling, CandidatesToCsvTransform, getUrl } from "./";
import { axiosConfig } from "../config";

export async function* fetchCandidates() {
  for (let page = 1; page <= Number.MAX_SAFE_INTEGER; page++) {
    const { data } = await fetchWithThrottling(getUrl(page), axiosConfig);
    yield data;

    if (CandidatesToCsvTransform.isLastPageProcessed) break;
  }
}
