import { Candidate, JobApplication, Links } from "./";

export interface Meta {
  "record-count": number;
  "page-count": number;
}

export interface JsonApiResponse {
  data: Candidate[];
  included?: JobApplication[];
  links: Links;
  meta: Meta;
}
