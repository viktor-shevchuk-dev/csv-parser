import { Transform, TransformOptions, TransformCallback } from "stream";
import zlib from "zlib";

interface JsonApiResponse {
  data: Candidate[];
  included?: JobApplication[];
  meta: Meta;
  links: Links;
}

interface Candidate {
  id: string;
  type: string;
  attributes: {
    "first-name": string;
    "last-name": string;
    email: string;
  };
  relationships: {
    "job-applications": {
      data: JobApplicationReference[];
    };
  };
}

interface JobApplicationReference {
  id: string;
  type: string;
}

interface JobApplication {
  id: string;
  type: string;
  attributes: {
    "created-at": string;
  };
}

interface Links {
  first: string;
  prev?: string;
  next?: string;
  last: string;
}

interface Meta {
  "record-count": number;
  "page-count": number;
}

export class CompressionStream extends Transform {
  constructor(options) {
    super(options);
    this.gzip = zlib.createGzip();
  }

  _transform(chunk, encoding, callback) {
    this.gzip.write(chunk, encoding, callback);
  }

  _flush(callback) {
    this.gzip.end();
    this.gzip.on("data", (chunk) => this.push(chunk));
    this.gzip.on("end", callback);
  }
}

export class CandidatesToCsvTransform extends Transform {
  public static isLastPageProcessed = false;
  public static recordCount = 0;

  constructor(options: TransformOptions = {}) {
    super({ ...options, objectMode: true });
  }

  _transform(
    chunk: { value: JsonApiResponse },
    _encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const {
      data: candidates,
      included = [],
      links: { next },
      meta,
    } = chunk.value;

    CandidatesToCsvTransform.recordCount = meta["record-count"];

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
