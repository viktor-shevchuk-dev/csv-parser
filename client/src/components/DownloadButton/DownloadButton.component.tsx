import { FC, useState } from "react";
import Box from "@mui/material/Box";
import { Button } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CheckIcon from "@mui/icons-material/Check";
import { green } from "@mui/material/colors";
import { toast } from "react-toastify";

import { Status } from "types";

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

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "candidates.csv";
      link.click();
      window.URL.revokeObjectURL(url);

      setStatus(Status.RESOLVED);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
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
