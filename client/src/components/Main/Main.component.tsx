import { FC } from "react";

import { ErrorBoundary } from "components";

export const Main: FC = () => {
  return (
    <main>
      <div className={"container"}>
        <ErrorBoundary></ErrorBoundary>
      </div>
    </main>
  );
};
