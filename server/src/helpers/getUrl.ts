import { getQueryParams } from "./";

export const getUrl = (pageNumber: number): string => {
  const params = getQueryParams(pageNumber);
  const queryString = new URLSearchParams(params).toString();
  return `${process.env.BASE_URL}/candidates?${queryString}`;
};
