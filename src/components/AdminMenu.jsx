import React, { useState } from "react";
import { saveAs } from "file-saver";
// import "./App.css";
// import AdminMenu from "/AdminMenu";
import {Link,useNavigate} from 'react-router-dom';
function Duplicator() {
  const [file, setFile] = useState(null);
  const [uniqueNumbers, setUniqueNumbers] = useState([]);
  const [tempTableNames, setTempTableNames] = useState([]);
  const [errorNumbers, setErrorNumbers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [batchStats, setBatchStats] = useState([]);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showPinPopup, setShowPinPopup] = useState(false);
  const [pin, setPin] = useState("");
  const [jobBatches, setJobBatches] = useState([]);
  const [stats, setStats] = useState({
    totalSent: 0,
    totalUnique: 0,
    duplicatesRemoved: 0,
  });

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
      
      const validNumbers = [];
      const invalidNumbers = [];
      rows.forEach((row) => {
        const numbers = row.split(",").map((item) => item.trim());
        numbers.forEach((number) => {
          if (/^\d{10}$/.test(number)) {
            validNumbers.push(number);
          } else if (number) {
            invalidNumbers.push(number);
          }
        });
      });

      // Store invalid numbers in state for download
      setErrorNumbers(invalidNumbers);

      // Process batches with valid numbers
      const totalSent = validNumbers.length;
      if (totalSent === 0) {
        setIsLoading(false);
        alert("No valid 10-digit phone numbers found in the file.");
        return;
      }

      // Set initial stats
      setStats((prevStats) => ({
        ...prevStats,
        totalSent,
        totalUnique: 0,
        duplicatesRemoved: 0,
      }));

      // Split valid numbers into batches
      const batches = [];
      for (let i = 0; i < validNumbers.length; i += 10000) {
        batches.push(validNumbers.slice(i, i + 10000));
      }

      // Process each batch
      let totalUnique = 0;
      for (let i = 0; i < batches.length; i++) {
        setProgress(`Processing batch ${i + 1} of ${batches.length}...`);
        try {
          const result = await processBatch(batches[i]);

          setUniqueNumbers((prevNumbers) => [...prevNumbers, ...result.uniqueNumbers]);
          totalUnique += result.uniqueNumbers.length;

          // Store temp table names
          setTempTableNames((prev) => [...prev, result.table_name]);

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
          return;
        }
      }

      setMessage("All batches processed successfully.");
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  const processBatch = async (batch) => {
    const dateTime = new Date().toISOString();
    const body = {
      numbers: batch,
      "date-time": dateTime,
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

    return response.json(); // Response contains { uniqueNumbers: [...], table_name: "temp_table_name" }
  };

  const handleDownload = async () => {
    if (uniqueNumbers.length > 0) {
      const csvData = [["Phone Numbers"], ...uniqueNumbers.map((phone) => [phone])];
      const csvContent = csvData.map((row) => row.join(",")).join("\n");
      const date = new Date();
      const formattedDate = date.toLocaleString().replace(/[/,: ]/g, "_");
      const fileName = `Unique Data - ${formattedDate} - ${uniqueNumbers.length}.csv`;
      saveAs(new Blob([csvContent], { type: "text/csv" }), fileName);

      // Call the /db-process API with the temp table names
      await processTables();
    } else {
      alert("No data available to download.");
    }
  };

  const handleErrorDownload = () => {
    if (errorNumbers.length > 0) {
      const date = new Date();
      const formattedDate = date.toLocaleString().replace(/[/,: ]/g, "_");
      const fileName = `error-data-${formattedDate}.csv`;
      const csvData = [["Invalid Phone Numbers"], ...errorNumbers.map((number) => [number])];
      const csvContent = csvData.map((row) => row.join(",")).join("\n");
      saveAs(new Blob([csvContent], { type: "text/csv" }), fileName);
    }
  };

  const processTables = async () => {
    try {
        console.log("Table Names being sent to API:", tempTableNames);

        // Make the POST request to the API
        const response = await fetch("https://mellow-sun-ckbco7ysvyhi.on-vapor.com/api/db-process", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({ tempTableName: tempTableNames }), // Properly formatted input
        });

        console.log("API response status:", response.status);

        if (response.ok) {
            const data = await response.json();
            console.log("API response:", data);
            setShowLightbox(true);
        } else {
            const errorText = await response.text(); // Get raw error response if JSON parsing fails
            console.error("Error response from API:", errorText);
            alert("Error merging the data into the master database: " + errorText);
        }
    } catch (error) {
        console.error("Error processing tables:", error);
        alert("An error occurred while processing tables: " + error.message);
    }
};


  const handlePinValidation = () => {
    if (pin === "4202") {
      setShowPinPopup(false);
      fetchJobBatches();
    } else {
      alert("Incorrect pin. Please try again.");
    }
  };

  const fetchJobBatches = async () => {
    try {
      // Change from GET to POST method
      const response = await fetch("https://mellow-sun-ckbco7ysvyhi.on-vapor.com/api/job-batch", {
        method: "GET", // Changed to POST to fix 405 error
        headers: {
          "Content-Type": "application/json",
        },
        // body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        setJobBatches(data);
      } else {
        const errorData = await response.json();
        console.error("Error response from API:", errorData);
        alert("Error fetching job batches: " + errorData.message);
      }
    } catch (error) {
      console.error("Error fetching job batches:", error.message);
      alert("An error occurred while fetching job batches.");
    }
  };

  const handleDataDownload = async (jobDt) => {
    try {
      const response = await fetch("https://mellow-sun-ckbco7ysvyhi.on-vapor.com/api/data-down", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_dt: jobDt }),
      });

      if (response.ok) {
        const { phone_numbers } = await response.json();
        const fileName = `data_copy_batch_${jobDt.replace(/[: ]/g, "_")}.csv`;
        const csvData = [["Phone Numbers"], ...phone_numbers.map((phone) => [phone])];
        const csvContent = csvData.map((row) => row.join(",")).join("\n");
        saveAs(new Blob([csvContent], { type: "text/csv" }), fileName);
      } else {
        alert("Error downloading data.");
      }
    } catch (error) {
      console.error("Error downloading data:", error.message);
      alert("An error occurred while downloading data.");
    }
  };
  const navigate = useNavigate();
  const handleClick = () => {
    navigate("/AdminMenu"); // Programmatically navigate to the AdminMenu page
  };
  

  const handleDataDelete = async (jobDt) => {
    try {
      const response = await fetch("https://mellow-sun-ckbco7ysvyhi.on-vapor.com/api/data-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_dt: jobDt }),
      });

      if (response.ok) {
        alert("Batch Deleted Successfully");
        setJobBatches((prevBatches) => prevBatches.filter((job) => job.job_dt !== jobDt));
      } else {
        alert("Error deleting batch.");
      }
    } catch (error) {
      console.error("Error deleting batch:", error.message);
      alert("An error occurred while deleting the batch.");
    }
  };

  return (
    <div className="App">
     <div className="lightbox" style={{ padding: "20px", borderRadius: "10px",border:"solid"}}>
          <div className="lightbox-content">
            <h2>Admin Access</h2>
            <label htmlFor="pinInput" style={{ display: "block", marginBottom: "10px",fontSize:"21px" }}>Enter Pin</label>

            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)} style={{height:"30px",width:"300px",marginBottom:"40px",borderRadius: '15px',fontSize:"24px"}}
            />
            <div>
            <button onClick={handlePinValidation} style={{
          marginRight: '100px',
          backgroundColor: 'green', /* blue color */
          color: 'white',
          border: 'none',
          borderRadius: '20px', /* rounded corners */
          padding: '10px 20px'
        }}>Submit</button>
            <button onClick={() => { setPin(""); setShowPinPopup(false)}}  style={{
          backgroundColor: 'red', /* red color */
          color: 'white',
          border: 'none',
          borderRadius: '20px',
          padding: '10px 20px'
        }}>Clear</button>
            </div>
          </div>
        </div>

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

      {errorNumbers.length > 0 && (
        <button style={{ position: "fixed", bottom: "20px", left: "20px" }} onClick={handleErrorDownload}>
          Download Error Data
        </button>
      )}



      {showPinPopup && (
        <div className="lightbox">
          <div className="lightbox-content">
            <h3>Enter Pin</h3>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <button onClick={handlePinValidation}>Submit</button>
            <button onClick={() => setShowPinPopup(false)}>Clear</button>
          </div>
        </div>
      )}

      {jobBatches.length > 0 && (
        <div>
          <h3>Job Batches</h3>
          <table border="1">
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Data Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobBatches.map((job) => (
                <tr key={job.job_dt}>
                  <td style={{ padding:"10px"}}>{job.job_dt}</td>
                  <td>{job.total}</td>
                  <td style={{ padding:"10px"}}>
                    <button onClick={() => handleDataDownload(job.job_dt)} style={{ marginRight:"20px"}}>Download</button>
                    <button onClick={() => handleDataDelete(job.job_dt)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
