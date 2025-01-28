import axios from "axios";
// import { Transform } from "json2csv";
import { EOL } from "os";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { asObjects } from "stream-csv-as-json/AsObjects";
import { stringer } from "stream-csv-as-json/Stringer";
import { Transform, pipeline, Readable } from "stream";
import { format, FormatterRow } from "fast-csv";
import csvWriter from "csv-write-stream";
import { promisify } from "util";
var jsonToCsv = require("json-to-csv-stream");
const pipelineAsync = promisify(pipeline);

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

const getUrl = (pageNumber: number) => {
  const params = {
    include: "job-applications",
    "fields[candidates]": "id,first-name,last-name,email,job-applications",
    "fields[job-applications]": "id,created-at",
    "page[size]": "30",
    "page[number]": String(pageNumber),
  };
  const queryString = new URLSearchParams(params).toString();

  return `${process.env.BASE_URL}/candidates?${queryString}`;
};

class CandidatesToCsvTransform extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: true });
  }

  static isLastPageProcessed = false;

  _transform(chunk, encoding, callback) {
    const {
      data: candidates,
      included,
      links: { next },
    } = chunk.value;

    const jobApplicationsMap = included.reduce((map, item) => {
      map[item.id] = item;
      return map;
    }, {});

    candidates.forEach((candidate) => {
      candidate.relationships["job-applications"].data.forEach((jobApp) => {
        const jobApplication = jobApplicationsMap[jobApp.id];

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

async function safeApiCall(url, config) {
  const { headers, data: jsonStream } = await axios.get(url, config);
  const limitRemaining = headers["x-rate-limit-remaining"];
  const limitReset = headers["x-rate-limit-reset"];

  if (Number(limitRemaining) <= 1) {
    const waitMs = Number(limitReset) * 1000;
    console.log(`Approaching limit. Waiting for ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return jsonStream;
}

const axiosConfig = {
  headers: {
    Authorization: `Token token=${process.env.API_KEY}`,
    "X-Api-Version": process.env.API_VERSION,
  },
  responseType: "stream",
};

const csvHeaders = [
  "candidate_id",
  "first_name",
  "last_name",
  "email",
  "job_application_id",
  "job_application_created_at",
];

const getCandidates = async (res, next) => {
  try {
    for (let page = 1; page <= Infinity; page++) {
      const jsonStream = await safeApiCall(getUrl(page), axiosConfig);
      await pipelineAsync(
        jsonStream,
        parser(),
        streamValues(),
        new CandidatesToCsvTransform(),
        csvWriter({ headers: csvHeaders, sendHeaders: page === 1 }),
        res,
        { end: false }
      );

      if (CandidatesToCsvTransform.isLastPageProcessed) break;
    }
    res.end();
  } catch (error) {
    next(error);
    console.log({ error });
  }
};

export default getCandidates;
