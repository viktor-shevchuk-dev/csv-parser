## 1 - Initializing lint-staged and husky

**MacOS** and **Linux** users need to run the following command in the terminal. This will install and configure husky and lint-staged based on the code quality tools listed in the project’s package.json.

```bash
npx mrm lint-staged
```

**Windows** users should execute the following command. It does the same thing.

```bash
npx mrm@2 lint-staged
```

## 2 - Project Setup

Clone the repo, create an **.env** file in the server folder and fill it with the following content:

```bash
BASE_URL = https://api.teamtailor.com/v1
API_VERSION = 20240904
API_KEY=<your-api-key>
```

## 3 - Installing Dependencies

Run the following commands in the root folder.

```bash
npm i
npm run dev
```
