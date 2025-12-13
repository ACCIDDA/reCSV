import React, { useCallback } from 'react';

interface FileUploadProps {
  onFileLoaded: (file: File) => void;
  onError: (error: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded, onError }) => {
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      onError('File size exceeds 100MB limit');
      return;
    }

    onFileLoaded(file);
  }, [onFileLoaded, onError]);

  return (
    <div className="w-full space-y-3">
      <label 
        htmlFor="csv-upload" 
        className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex flex-col items-center justify-center py-6">
          <svg 
            className="w-10 h-10 mb-3 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
            />
          </svg>
          <p className="mb-1 text-sm text-gray-600">
            <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">CSV files up to 100MB</p>
        </div>
        <input 
          id="csv-upload" 
          type="file" 
          className="hidden" 
          accept=".csv,text/csv"
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
};
