import { Transform, TransformOptions, TransformCallback } from "stream";

import { JsonApiResponse, JobApplication } from "../types";

export class CandidatesToCsvTransform extends Transform {
  public static isLastPageProcessed = false;

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
    } = chunk.value;

    const jobApplicationsMap: Record<string, JobApplication> = included.reduce(
      (map, item) => {
        map[item.id] = item;
        return map;
      },
      {} as Record<string, JobApplication>
    );

    candidates.forEach((candidate) => {
      candidate.relationships["job-applications"].data.forEach((jobRef) => {
        const jobApplication = jobApplicationsMap[jobRef.id];

        const transformed = {
          candidate_id: candidate.id,
          first_name: candidate.attributes["first-name"],
          last_name: candidate.attributes["last-name"],
          email: candidate.attributes.email,
          job_application_id: jobApplication.id,
          job_application_created_at: jobApplication.attributes["created-at"],
        };

        this.push(transformed);
      });
    });
    CandidatesToCsvTransform.isLastPageProcessed = !Boolean(next);
    callback();
  }
}
