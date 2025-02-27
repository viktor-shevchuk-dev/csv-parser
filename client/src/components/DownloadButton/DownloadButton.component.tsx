import { FC, useState } from "react";
import Box from "@mui/material/Box";
import { Button } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CheckIcon from "@mui/icons-material/Check";
import { green } from "@mui/material/colors";
import { toast } from "react-toastify";

import { Status } from "types";

const USE_DISK_STREAMING = false;

declare global {
  interface Window {
    showSaveFilePicker: (options?: any) => Promise<FileSystemFileHandle>;
  }
}

export const DownloadButton: FC = () => {
  const [status, setStatus] = useState(Status.IDLE);

  const buttonSx = {
    ...(status === Status.RESOLVED && {
      bgcolor: green[500],
      "&:hover": {
        bgcolor: green[700],
      },
    }),
  };

  const handleButtonClick = async (): Promise<void> => {
    setStatus(Status.PENDING);
    try {
      const API_URL = "http://localhost:4000/api/candidates";
      const response = await fetch(API_URL, {
        headers: { "Accept-Encoding": "br" },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch file. Status: ${response.status}`);
      }

      if (USE_DISK_STREAMING && "showSaveFilePicker" in window) {
        const readableStream = response.body;
        if (!readableStream) {
          throw new Error("No response body");
        }

        const fileHandle = await window.showSaveFilePicker({
          suggestedName: "candidates.csv",
        });

        const writableStream = await fileHandle.createWritable();

        await readableStream.pipeTo(writableStream);
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "candidates.csv";
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }

      setStatus(Status.RESOLVED);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          toast.info("Save cancelled by user.");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("An unknown error occurred.");
      }

      setStatus(Status.REJECTED);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <Button
        color="primary"
        onClick={handleButtonClick}
        loading={status === Status.PENDING}
        loadingPosition="start"
        startIcon={status === Status.RESOLVED ? <CheckIcon /> : <SaveIcon />}
        variant="contained"
        sx={buttonSx}
      >
        Download candidates
      </Button>
    </Box>
  );
};
