import app from "./app";
const { DB_HOST = "" } = process.env;

app.listen(4000, () => {
  console.log("The server is running...");
});
