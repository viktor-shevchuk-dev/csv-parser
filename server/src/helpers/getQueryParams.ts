export const getQueryParams = (pageNumber: number) => ({
  include: "job-applications",
  "fields[candidates]": "id,first-name,last-name,email,job-applications",
  "fields[job-applications]": "id,created-at",
  "page[size]": "30",
  "page[number]": String(pageNumber),
});
