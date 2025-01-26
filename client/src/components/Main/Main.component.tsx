import { FC, useEffect, useState } from "react";

import { ErrorBoundary } from "components";

export const Main: FC = () => {
  // const url = 'http://localhost:4000/api/books';

  const downloadFile = async () => {
    const response = await fetch("http://localhost:4000/api/books");
    const reader = response?.body?.getReader();

    let chunks = [];

    while (true) {
      const { done, value } = await reader.read();

      console.log(value);

      if (done) break;

      chunks.push(value);
    }

    const blob = new Blob(chunks);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    console.log(url);
    link.href = url;
    link.download = "downloaded_file.csv";
    document.body.appendChild(link);
    link.click();

    window.URL.revokeObjectURL(url);
    link.remove();
  };

  return (
    <main>
      <div className="container">
        <ErrorBoundary>
          {/* <button onClick={downloadCandidates} type="button">
            Submit
          </button> */}
          {/* <a href={url}>Download</a> */}

          <button onClick={downloadFile}>Download File</button>
        </ErrorBoundary>
      </div>
    </main>
  );
};
