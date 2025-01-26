import axios from "axios";
// import { Transform } from "json2csv";
import { EOL } from "os";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { asObjects } from "stream-csv-as-json/AsObjects";
import { stringer } from "stream-csv-as-json/Stringer";
import { Transform } from "stream";
import { format, FormatterRow } from "fast-csv";
import csvWriter from "csv-write-stream";
import { pipeline } from "stream";
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

let counter = 1;

const fetchWithErrorHandling = async (
  url = "",
  config = {}
): Promise<JsonApiResponse> => {
  const response = await fetch(url, config);

  return response.ok
    ? (response.json() as Promise<JsonApiResponse>)
    : Promise.reject(new Error(`${response.statusText}: ${response.status}`));
};

const getEndpoint = (num = "1") => {
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

const getOpts = (num) => {
  return {
    transform(chunk, encoding, callback) {
      this.push(chunk + "\n");
      callback();
    },
    objectMode: true,
    fields: [
      // {
      //   label: "test",
      //   value: (row) => row.data.map((candidate) => candidate.id).join("\n"), // does not work. find a way in the docs to map multiple entries (30 items). find maybe another csv parser which parses streams
      // },
      {
        label: `candidate_id`,
        value: `data[${0}].id`,
      },
      {
        label: `first_name`,
        value: `data[${0}].attributes['first-name']`,
      },
      {
        label: `last_name`,
        value: `data[${0}].attributes['last-name']`,
      },
      {
        label: `email`,
        value: `data[${0}].attributes.email`,
      },
      {
        label: `job_application_id`,
        value: `data[${0}].relationships['job-applications'].data[${0}].id`,
      },
      {
        label: `job_application_created_at`,
        value: `included[${0}].attributes['created-at']`,
      },
    ],
  };
};

class MyCustomTransform extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: true });
  }

  _transform(chunk, encoding, callback) {
    const candidates = chunk.value.data; // Assuming the data array is directly in chunk.value
    candidates.forEach((candidate) => {
      const transformed = {
        id: candidate.id,
        firstName: candidate.attributes["first-name"],
        lastName: candidate.attributes["last-name"],
        email: candidate.attributes.email,
        // Assuming the first job application's ID is what you need
        jobApplicationId:
          candidate.relationships["job-applications"].data[0]?.id,
      };

      this.push(transformed); // Push each transformed candidate to the next step in the stream
    });
    callback(); // Signal that the processing for this chunk is complete
  }
}

const getCandidates = async (res, next) => {
  const { API_KEY, API_VERSION } = process.env;

  const headers = {
    Authorization: `Token token=${API_KEY}`,
    "X-Api-Version": API_VERSION,
  };

  // const data: JsonApiResponse = await fetchWithErrorHandling(url, {
  //   headers,
  // });

  // return data;

  let recordCount = 10;

  try {
    for (let i = 1; i <= recordCount; i++) {
      // await new Promise((resolve) => setTimeout(resolve, 0));

      // const opts = { ...getOpts(i), header: i === 1 };
      // const json2csv = new Transform(opts);

      const endpoint = getEndpoint(i.toString());
      const { data: jsonStream } = await axios.get(endpoint, {
        headers,
        responseType: "stream",
      });

      // jsonStream.on("data", (chunk) => {
      //   // console.log(chunk.toString());
      //   console.log(879787898);
      //   // console.log(chunk);
      // });

      const jsonParser = parser();
      const valueStream = streamValues();
      const transformer = new MyCustomTransform();
      const writer = csvWriter({
        headers: ["id", "fullName", "email", "jobApplicationId"],
      });

      const isLastPage = i === recordCount;

      await pipelineAsync(
        jsonStream,
        jsonParser,
        valueStream,
        transformer,
        writer,
        res,
        { end: isLastPage }
      );

      // jsonStream.pipe(json2csv).pipe(res, { end: isLastPage });
      // if (i !== 1) res.write(EOL);
    }
  } catch (error) {
    next(error);
    console.log({ error });
  }

  // res.end();

  // const response1 = await axios.get(getEndpoint("1"), {
  //   headers,
  //   responseType: "stream",
  // });
  // const json2csv = new Transform(opts);
  // response1.data.pipe(json2csv).pipe(res, { end: false });

  // response1.data.on("end", async () => {
  //   const response2 = await axios.get(getEndpoint("2"), {
  //     headers,
  //     responseType: "stream",
  //   });
  //   const json2csv = new Transform({ ...opts, header: false });

  //   response2.data.pipe(json2csv).pipe(res, { end: true });
  // });
};

export default getCandidates;
