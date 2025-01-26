import axios from "axios";
import { Transform } from "json2csv";
const https = require("https");
import { PassThrough } from "stream";

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
    objectMode: true,
    fields: [
      {
        label: "test",
        value: (row) => row.data.map((candidate) => candidate.id).join("\n"), // does not work. find a way in the docs to map multiple entries (30 items)
      },
      {
        label: `candidate_id`,
        value: `data[${num}].id`,
      },
      {
        label: `first_name`,
        value: `data[${num}].attributes['first-name']`,
      },
      {
        label: `last_name`,
        value: `data[${num}].attributes['last-name']`,
      },
      {
        label: `email`,
        value: `data[${num}].attributes.email`,
      },
      {
        label: `job_application_id`,
        value: `data[${num}].relationships['job-applications'].data[${num}].id`,
      },
      {
        label: `job_application_created_at`,
        value: `included[${num}].attributes['created-at']`,
      },
    ],
  };
};

const getCandidates = async (res) => {
  const { API_KEY, API_VERSION } = process.env;

  const headers = {
    Authorization: `Token token=${API_KEY}`,
    "X-Api-Version": API_VERSION,
  };

  // const data: JsonApiResponse = await fetchWithErrorHandling(url, {
  //   headers,
  // });

  // return data;

  // return await axios.get(url, {
  //   headers,
  //   responseType: "stream",
  // });
  // console.log({ url, headers });

  let recordCount = 1;

  for (let i = 1; i <= recordCount; i++) {
    const endpoint = getEndpoint(i.toString());
    const response = await axios.get(endpoint, {
      headers,
      responseType: "stream",
    });

    response.data.on("data", (chunk) => {
      console.log(chunk.toString());
    });

    const json2csv = new Transform({ ...getOpts(i), header: i === 1 });
    response.data.pipe(json2csv).pipe(res, { end: recordCount === i });
    await new Promise((resolve, reject) => {
      json2csv.on("finish", resolve);
      json2csv.on("error", reject);
    });
    if (i < recordCount) {
      res.write("\n"); // Ensure there's a newline between CSV data sets
    }
  }
  // res.end();

  // const response1 = await axios.get(getEndpoint("1"), {
  //   headers,
  //   responseType: "stream",
  // });
  // const json2csv = new Transform(opts);
  // response1.data.pipe(json2csv).pipe(res, { end: false });

  // response1.data.on("end", async () => {
  //   res.write("\n");

  //   const response2 = await axios.get(getEndpoint("2"), {
  //     headers,
  //     responseType: "stream",
  //   });
  //   const json2csv = new Transform({ ...opts, header: false });

  //   response2.data.pipe(json2csv).pipe(res, { end: true });
  // });
};

export default getCandidates;
