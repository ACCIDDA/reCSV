export interface CSVData {
  headers: string[];
  rows: Record<string, any>[];
  preview: Record<string, any>[]; // First 10 rows for display
  totalRows: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TransformationState {
  code: string | null;
  validated: boolean;
  error: string | null;
}
