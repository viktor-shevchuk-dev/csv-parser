import { AxiosRequestConfig } from "axios";

export const axiosConfig: AxiosRequestConfig = {
  headers: {
    Authorization: `Token token=${process.env.API_KEY}`,
    "X-Api-Version": process.env.API_VERSION,
  },
  responseType: "stream",
};
