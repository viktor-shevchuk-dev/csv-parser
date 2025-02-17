import { Transform, TransformOptions, TransformCallback } from "stream";

import { JsonApiResponse, JobApplication } from "../types";
let test = 0;
export class CandidatesToCsvTransform extends Transform {
  public PAGE_COUNT: number = 0;

  constructor(options: TransformOptions = {}) {
    super({ ...options, objectMode: true });
  }

  _transform(
    chunk: { value: JsonApiResponse },
    _encoding: BufferEncoding,
    callback: TransformCallback
  ) {
    const {
      data: candidates,
      included = [],
      links: { next },
      meta,
    } = chunk.value;
    this.PAGE_COUNT = chunk.value.meta["page-count"];
    console.log(++test);

    const jobApps = new Map<string, JobApplication>(
      included.map((item) => [item.id, item])
    );

    candidates.forEach((candidate) => {
      const jobRefs = candidate.relationships["job-applications"].data;

      for (const jobRef of jobRefs) {
        const jobApplication = jobApps.get(jobRef.id);
        if (!jobApplication) continue;

        const transformed = {
          candidate_id: candidate.id,
          first_name: candidate.attributes["first-name"],
          last_name: candidate.attributes["last-name"],
          email: candidate.attributes.email,
          job_application_id: jobApplication.id,
          job_application_created_at: jobApplication.attributes["created-at"],
        };

        this.push(transformed);
      }
    });
    callback();
  }
}
