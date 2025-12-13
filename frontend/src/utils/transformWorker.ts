// Utility to create and manage the transformation worker

export interface TransformResult {
  success: boolean;
  data?: Record<string, any>[];
  error?: string;
  rowIndex?: number;
}

export class TransformWorker {
  private worker: Worker | null = null;

  constructor() {
    // Worker will be initialized when needed
  }

  async transform(
    code: string, 
    rows: Record<string, any>[],
    timeout = 10000
  ): Promise<TransformResult> {
    return new Promise((resolve) => {
      // Create worker from inline code to avoid module loading issues
      const workerCode = `
        self.onmessage = function(event) {
          const { type, code, rows, timeout } = event.data;
          
          if (type !== 'transform') {
            self.postMessage({ type: 'error', error: 'Unknown message type' });
            return;
          }
          
          try {
            // Try to create function that operates on all rows first
            let transformFn;
            try {
              transformFn = new Function('rows', code);
              const result = transformFn(rows);
              
              // If result is an array, use it directly
              if (Array.isArray(result)) {
                self.postMessage({ type: 'success', results: result });
                return;
              }
            } catch (e) {
              // If whole-array transformation fails, fall back to row-by-row
            }
            
            // Fall back to row-by-row transformation
            transformFn = new Function('row', 'index', code);
            const results = [];
            
            for (let i = 0; i < rows.length; i++) {
              try {
                const result = transformFn(rows[i], i);
                // If result is an array, flatten it (one row produces multiple rows)
                if (Array.isArray(result)) {
                  results.push(...result);
                } else {
                  results.push(result);
                }
              } catch (error) {
                self.postMessage({ 
                  type: 'error', 
                  error: 'Error at row ' + i + ': ' + error.message,
                  rowIndex: i
                });
                return;
              }
            }
            
            self.postMessage({ type: 'success', results });
          } catch (error) {
            self.postMessage({ 
              type: 'error', 
              error: 'Failed to create transformation function: ' + error.message
            });
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      // Set up message handler
      this.worker.onmessage = (event) => {
        const { type, results, error, rowIndex } = event.data;
        
        if (type === 'success') {
          resolve({ success: true, data: results });
        } else {
          resolve({ success: false, error, rowIndex });
        }
        
        this.terminate();
      };

      // Set up error handler
      this.worker.onerror = (error) => {
        resolve({ 
          success: false, 
          error: `Worker error: ${error.message}` 
        });
        this.terminate();
      };

      // Send transformation request
      this.worker.postMessage({
        type: 'transform',
        code,
        rows,
        timeout
      });
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Clean approach: inline worker creation avoids MIME type and module loading issues
