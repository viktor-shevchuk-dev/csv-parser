import { getQueryParams } from "./";

export const getUrl = (pageNumber: number, pageSize: number): string => {
  const params = getQueryParams(pageNumber, pageSize);
  const queryString = new URLSearchParams(params).toString();
  return `${process.env.BASE_URL}/candidates?${queryString}`;
};
