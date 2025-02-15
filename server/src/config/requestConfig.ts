export const requestConfig = {
  headers: {
    Authorization: `Token token=${process.env.API_KEY}`,
    "X-Api-Version": process.env.API_VERSION ?? "",
  },
};
