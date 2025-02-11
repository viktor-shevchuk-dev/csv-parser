import { Candidate, JobApplication, Links } from "./";

export interface JsonApiResponse {
  data: Candidate[];
  included?: JobApplication[];
  links: Links;
}
