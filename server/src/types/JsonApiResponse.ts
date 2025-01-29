import { Candidate, JobApplication, Meta, Links } from "./";

export interface JsonApiResponse {
  data: Candidate[];
  included?: JobApplication[];
  meta: Meta;
  links: Links;
}
