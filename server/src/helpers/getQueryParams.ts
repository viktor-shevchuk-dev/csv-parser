export const getQueryParams = (pageNumber: number, pageSize: number) => ({
  include: "job-applications",
  "fields[candidates]": "id,first-name,last-name,email,job-applications",
  "fields[job-applications]": "id,created-at",
  "page[size]": String(pageSize),
  "page[number]": String(pageNumber),
});
