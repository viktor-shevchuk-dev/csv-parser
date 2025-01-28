export const getUrl = (pageNumber: number): string => {
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
