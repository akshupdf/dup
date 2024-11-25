// src/components/Upload.jsx

import React, { useState } from "react";
import { saveAs } from "file-saver";
import "./App.css";

function Duplicator() {
  const [file, setFile] = useState(null);
  const [uniqueNumbers, setUniqueNumbers] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [stats, setStats] = useState({
    totalSent: 0,
    totalUnique: 0,
    duplicatesRemoved: 0,
  });
  const [batchStats, setBatchStats] = useState([]);
  const [tempTableNames, setTempTableNames] = useState([]);
  const [showLightbox, setShowLightbox] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];

    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
    } else {
      alert("Please select a valid CSV file.");
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a CSV file first.");
      return;
    }

    setIsLoading(true);
    setProgress("Reading file...");
    const reader = new FileReader();

    reader.onload = async (event) => {
      const fileContent = event.target.result;
      const rows = fileContent.split(/\r?\n/);

      const phoneNumbers = rows
        .flatMap((row) => row.split(","))
        .map((item) => item.trim())
        .filter((item) => /^\d{10}$/.test(item));

      const totalSent = phoneNumbers.length;

      if (totalSent === 0) {
        setIsLoading(false);
        alert("No valid 10-digit phone numbers found in the file.");
        return;
      }

      setStats((prevStats) => ({
        ...prevStats,
        totalSent,
      }));

      const batches = [];
      for (let i = 0; i < phoneNumbers.length; i += 10000) {
        batches.push(phoneNumbers.slice(i, i + 10000));
      }

      let totalUnique = 0;
      for (let i = 0; i < batches.length; i++) {
        setProgress(`Processing batch ${i + 1} of ${batches.length}...`);
        try {
          await delay(200);
          const result = await processBatch(batches[i]);

          // Merge new unique numbers from this batch into the existing ones
          setUniqueNumbers((prevNumbers) => [...prevNumbers, ...result.uniqueNumbers]);
          totalUnique += result.uniqueNumbers.length;

          // Store the temp table name
          setTempTableNames((prevTableNames) => [...prevTableNames, result.tableName]);

          // Update batch stats
          setBatchStats((prevStats) => [
            ...prevStats,
            {
              batchNumber: i + 1,
              batchTotalSent: batches[i].length,
              batchUniqueReceived: result.uniqueNumbers.length,
              batchDuplicatesRemoved: batches[i].length - result.uniqueNumbers.length,
            },
          ]);

          // Update cumulative stats
          setStats((prevStats) => ({
            ...prevStats,
            totalUnique,
            duplicatesRemoved: prevStats.totalSent - totalUnique,
          }));
        } catch (error) {
          console.error("Error processing batch:", error.message);
          alert(`Error processing batch ${i + 1}: ${error.message}`);
          setIsLoading(false);
          setMessage("Error occurred. Partial data is available for download.");
          return;
        }
      }

      setMessage("All batches processed successfully.");
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  const processBatch = async (batch) => {
    const body = {
      numbers: batch,
    };

    const response = await fetch("https://mellow-sun-ckbco7ysvyhi.on-vapor.com/api/upload-leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Something went wrong");
    }

    return response.json(); // The response should contain { uniqueNumbers: [...], tableName: "temp_table_name" }
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleDownload = async () => {
    if (uniqueNumbers.length > 0) {
      const csvData = [["Phone Numbers"], ...uniqueNumbers.map((phone) => [phone])];
      const csvContent = csvData.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const date = new Date();
      const formattedDate = date.toLocaleString().replace(/[/,: ]/g, "_");
      const fileName = `Unique Data - ${formattedDate} - ${uniqueNumbers.length}.csv`;
      saveAs(blob, fileName);

      // Call the /api/db-process API with the temp table names
      await processTables();
    } else {
      alert("No data available to download.");
    }
  };

  const processTables = async () => {
    try {
      alert(`Input Params for db-process API: ${JSON.stringify({ tableNames: tempTableNames })}`);

      const response = await fetch("https://mellow-sun-ckbco7ysvyhi.on-vapor.com/api/db-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tableNames: tempTableNames }),
      });

      if (response.ok) {
        setShowLightbox(true);
      } else {
        alert("Error merging the data into the master database.");
      }
    } catch (error) {
      console.error("Error processing tables:", error.message);
      alert("An error occurred while processing tables.");
    }
  };

  return (
    <div className="App">
      <h1>Duplicator App</h1>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>

      {isLoading && (
        <div className="loading-container">
          <div className="loader"></div>
          <p>Loading...</p>
        </div>
      )}

      {progress && <p>{progress}</p>}

      {batchStats.length > 0 && (
        <div>
          <h3>Batch Statistics</h3>
          {batchStats.map((batch) => (
            <div key={batch.batchNumber}>
              <p>Batch {batch.batchNumber}</p>
              <p>Total Sent: {batch.batchTotalSent}</p>
              <p>Unique Received: {batch.batchUniqueReceived}</p>
              <p>Duplicates Removed: {batch.batchDuplicatesRemoved}</p>
            </div>
          ))}
        </div>
      )}

      {uniqueNumbers.length > 0 && (
        <>
          <button onClick={handleDownload}>Download CSV</button>
          <table border="1">
            <thead>
              <tr>
                <th>Phone Numbers</th>
              </tr>
            </thead>
            <tbody>
              {uniqueNumbers.map((phone, index) => (
                <tr key={index}>
                  <td>{phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {message && (
        <div>
          <h3>Final Statistics</h3>
          <p>{message}</p>
          <p>Data Sent: {stats.totalSent}</p>
          <p>Unique Data Received: {stats.totalUnique}</p>
          <p>Total Duplicates Removed: {stats.duplicatesRemoved}</p>
        </div>
      )}

      {showLightbox && (
        <div className="lightbox">
          <div className="lightbox-content">
            <p>The unique data has been successfully merged into the master database.</p>
            <button onClick={() => setShowLightbox(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Duplicator;
