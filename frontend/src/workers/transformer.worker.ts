// Web Worker for executing transformation code in isolation
// This worker receives AI-generated code and applies it to CSV rows

interface TransformMessage {
  type: 'transform';
  code: string;
  rows: Record<string, any>[];
  timeout?: number;
}

interface TransformResult {
  type: 'success' | 'error';
  results?: Record<string, any>[];
  error?: string;
  rowIndex?: number;
}

self.onmessage = (event: MessageEvent<TransformMessage>) => {
  const { type, code, rows, timeout = 5000 } = event.data;

  if (type !== 'transform') {
    postMessage({ type: 'error', error: 'Unknown message type' });
    return;
  }

  try {
    // Create a timeout mechanism
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      postMessage({ 
        type: 'error', 
        error: 'Transformation timed out' 
      });
    }, timeout);

    // Create the transformation function
    // The code should be a function body that returns the transformed row
    // Example: "return { date: row.timestamp, value: parseInt(row.count) }"
    const transformFn = new Function('row', 'index', code) as (row: any, index: number) => any;

    // Transform each row
    const results: Record<string, any>[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      if (timedOut) break;
      
      try {
        const result = transformFn(rows[i], i);
        results.push(result);
      } catch (error) {
        clearTimeout(timeoutId);
        postMessage({ 
          type: 'error', 
          error: `Error at row ${i}: ${error instanceof Error ? error.message : String(error)}`,
          rowIndex: i
        });
        return;
      }
    }

    clearTimeout(timeoutId);
    
    if (!timedOut) {
      postMessage({ 
        type: 'success', 
        results 
      } as TransformResult);
    }

  } catch (error) {
    postMessage({ 
      type: 'error', 
      error: `Failed to create transformation function: ${error instanceof Error ? error.message : String(error)}`
    });
  }
};

// Export empty object for TypeScript
export {};
