// src/components/ErrorData.jsx

import React from 'react';
import { saveAs } from 'file-saver';

const ErrorData = ({ errorNumbers }) => {
  const handleErrorDownload = () => {
    if (errorNumbers.length > 0) {
      const date = new Date();
      const formattedDate = date.toLocaleString().replace(/[/,: ]/g, "_");
      const fileName = `error-data-${formattedDate}.csv`;
      const csvData = [["Invalid Phone Numbers"], ...errorNumbers.map((number) => [number])];
      const csvContent = csvData.map((row) => row.join(",")).join("\n");
      saveAs(new Blob([csvContent], { type: "text/csv" }), fileName);
    } else {
      alert("No error data available.");
    }
  };

  return (
    errorNumbers.length > 0 && (
      <button style={{ position: "fixed", bottom: "20px", left: "20px" }} onClick={handleErrorDownload}>
        Download Error Data
      </button>
    )
  );
};

export default ErrorData;
