import { getQueryParams } from "./";

const PAGE_SIZE = 30;

export const getUrl = (
  pageNumber: number,
  pageSize: number = PAGE_SIZE
): string => {
  const params = getQueryParams(pageNumber, pageSize);
  const queryString = new URLSearchParams(params).toString();
  return `${process.env.BASE_URL}/candidates?${queryString}`;
};
