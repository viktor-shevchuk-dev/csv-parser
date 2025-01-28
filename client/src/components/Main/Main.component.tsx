import { FC } from "react";

import { ErrorBoundary, DownloadButton } from "components";

export const Main: FC = () => {
  return (
    <main>
      <div className="container">
        <ErrorBoundary>
          <DownloadButton />
        </ErrorBoundary>
      </div>
    </main>
  );
};
