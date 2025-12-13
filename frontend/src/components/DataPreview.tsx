import React from 'react';

interface DataPreviewProps {
  title: string;
  headers: string[];
  rows: Record<string, any>[];
  totalRows?: number;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ 
  title, 
  headers, 
  rows,
  totalRows 
}) => {
  if (rows.length === 0) {
    return (
      <div className="w-full p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-inner">
        <h3 className="text-lg font-semibold mb-2 text-gray-700">{title}</h3>
        <p className="text-sm text-gray-500">No data to display</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        {totalRows && (
          <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
            Showing {rows.length} of {totalRows.toLocaleString()} rows
          </span>
        )}
      </div>
      
      <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-purple-50 to-blue-50">
            <tr>
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className="px-4 py-3 text-left text-xs font-bold text-purple-700 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-purple-50/30 transition-colors">
                {headers.map((header, colIdx) => (
                  <td
                    key={colIdx}
                    className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap"
                  >
                    {row[header] !== null && row[header] !== undefined 
                      ? String(row[header]) 
                      : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
