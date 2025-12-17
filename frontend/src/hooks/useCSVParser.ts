import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { CSVData } from '../types';

export function useCSVParser() {
  const [inputData, setInputData] = useState<CSVData | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [hasHeaders, setHasHeaders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parseCSVFile = useCallback((file: File, useHeaders: boolean, isInitialLoad = false, onComplete?: (data: CSVData) => void) => {
    Papa.parse(file, {
      header: useHeaders,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing errors: ${results.errors[0].message}`);
          return;
        }

        const rows = results.data as Record<string, any>[];
        let headers = results.meta.fields || [];
        
        // If no headers, create generic column names
        if (!useHeaders && rows.length > 0) {
          headers = Object.keys(rows[0]);
        }

        if (rows.length === 0) {
          setError('CSV file is empty');
          return;
        }

        const csvData: CSVData = {
          headers,
          rows,
          preview: rows.slice(0, 10),
          totalRows: rows.length
        };

        setInputData(csvData);
        setError(null);
        
        // Call completion callback if provided
        if (isInitialLoad && onComplete) {
          onComplete(csvData);
        }
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`);
      }
    });
  }, []);

  const handleFileLoaded = useCallback((file: File, onComplete?: (data: CSVData) => void) => {
    setUploadedFile(file);
    parseCSVFile(file, hasHeaders, true, onComplete);
  }, [hasHeaders, parseCSVFile]);

  const reParseFile = useCallback((useHeaders?: boolean) => {
    if (uploadedFile) {
      parseCSVFile(uploadedFile, useHeaders ?? hasHeaders, false);
    }
  }, [uploadedFile, hasHeaders, parseCSVFile]);

  const reset = useCallback(() => {
    setInputData(null);
    setUploadedFile(null);
    setHasHeaders(true);
    setError(null);
  }, []);

  return {
    inputData,
    uploadedFile,
    hasHeaders,
    error,
    setHasHeaders,
    setError,
    handleFileLoaded,
    reParseFile,
    reset
  };
}
