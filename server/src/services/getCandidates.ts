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

const getEndpoint = (num) => {
  const { BASE_URL } = process.env;

  const params = {
    include: "job-applications",
    "fields[candidates]": "id,first-name,last-name,email,job-applications",
    "fields[job-applications]": "id,created-at",
    "page[size]": "30",
    "page[number]": num,
  };

  const queryString = new URLSearchParams(params).toString();
  const endpoint = `${BASE_URL}/candidates?${queryString}`;
  return endpoint;
};

class MyCustomTransform extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: true });
  }

  _transform(chunk, encoding, callback) {
    const { data: candidates, included } = chunk.value;
    console.log(chunk);

    const jobApplicationsMap = included.reduce((map, item) => {
      map[item.id] = item;
      return map;
    }, {});

    candidates.forEach((candidate) => {
      const jobApplications = candidate.relationships["job-applications"].data;

      jobApplications.forEach((jobAppData) => {
        const jobApplication = jobApplicationsMap[jobAppData.id];

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

async function getFirstPage(headers: any) {
  const url = getEndpoint(1);
  // Make the API call for the first page:
  const firstPageStream = await safeApiCall(url, {
    headers,
    responseType: "stream",
  });

  // We'll buffer this entire first page into memory
  // (which is usually OK if the page[size] isn't huge).
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    firstPageStream.on("data", (chunk) => chunks.push(chunk));
    firstPageStream.on("end", () => resolve());
    firstPageStream.on("error", (err) => reject(err));
  });

  // Convert all buffered chunks into one JSON object:
  const buffered = Buffer.concat(chunks).toString("utf8");
  const firstPageData: JsonApiResponse = JSON.parse(buffered);

  return firstPageData;
}

function createReadableFromObject(json: JsonApiResponse) {
  const r = new Readable({
    read() {
      // Convert object to string, push it, then end
      this.push(JSON.stringify(json));
      this.push(null);
    },
  });
  return r;
}

const getCandidates = async (res, next) => {
  const { API_KEY, API_VERSION } = process.env;

  const headers = {
    Authorization: `Token token=${API_KEY}`,
    "X-Api-Version": API_VERSION,
  };

  const firstPageData = await getFirstPage(headers);
  const pageCount = firstPageData.meta["page-count"];
  const firstPageReadable = createReadableFromObject(firstPageData);

  await pipelineAsync(
    firstPageReadable,
    parser(),
    streamValues(),
    new MyCustomTransform(),
    csvWriter({
      headers: [
        "candidate_id",
        "first_name",
        "last_name",
        "email",
        "job_application_id",
        "job_application_created_at",
      ],
      sendHeaders: true,
    }),
    res,
    { end: false }
  );

  for (let page = 2; page <= pageCount; page++) {
    const url = getEndpoint(page);
    const pageStream = await safeApiCall(url, {
      headers,
      responseType: "stream",
    });
    const isLastPage = page === pageCount;

    await pipelineAsync(
      pageStream,
      parser(),
      streamValues(),
      new MyCustomTransform(),
      csvWriter({
        headers: [
          "candidate_id",
          "first_name",
          "last_name",
          "email",
          "job_application_id",
          "job_application_created_at",
        ],
        sendHeaders: false,
      }),
      res,
      { end: isLastPage }
    );
  }

  // try {
  //   for (let i = 1; i <= recordCount; i++) {
  //     const url = getEndpoint(i.toString());
  //     const jsonStream = await safeApiCall(url, {
  //       headers,
  //       responseType: "stream",
  //     });

  //     jsonStream.on("data", (chunk) => {
  //       // console.log(chunk.toString());
  //       // console.log(879787898);
  //       // console.log(chunk);
  //     });
  //     const isFirstPage = i === 1;

  //     const jsonParser = parser();
  //     const valueStream = streamValues();
  //     const transformer = new MyCustomTransform();
  //     const writer = csvWriter({
  //       headers: [
  //         "candidate_id",
  //         "first_name",
  //         "last_name",
  //         "email",
  //         "job_application_id",
  //         "job_application_created_at",
  //       ],
  //       sendHeaders: isFirstPage,
  //     });

  //     const isLastPage = i === recordCount;

  //     await pipelineAsync(
  //       jsonStream,
  //       jsonParser,
  //       valueStream,
  //       transformer,
  //       writer,
  //       res,
  //       { end: isLastPage }
  //     );
  //   }
  // } catch (error) {
  //   next(error);
  //   console.log({ error });
  // }
};

export default getCandidates;
