import { useState, useCallback } from 'react';
import { CSVData } from '../types';
import { chatApi } from '../api/chat';
import { TransformWorker } from '../utils/transformWorker';

export function useTransformation() {
  const [outputData, setOutputData] = useState<CSVData | null>(null);
  const [transformCode, setTransformCode] = useState<string | null>(null);
  const [isFullTransformation, setIsFullTransformation] = useState(false);
  const [verificationRound, setVerificationRound] = useState(0);
  const MAX_VERIFICATION_ROUNDS = parseInt(import.meta.env.VITE_MAX_VERIFICATION_ROUNDS || '2');

  const executeTransformation = useCallback(async (
    code: string,
    inputData: CSVData,
    previewOnly = false,
    skipVerification = false
  ): Promise<{ success: boolean; transformedRows?: Record<string, any>[]; error?: string }> => {
    if (!inputData) return { success: false, error: 'No input data' };

    try {
      const worker = new TransformWorker();
      const rowsToTransform = previewOnly ? inputData.preview : inputData.rows;
      
      const result = await worker.transform(code, rowsToTransform);

      if (result.success && result.data) {
        const transformedRows = result.data;
        const headers = transformedRows.length > 0 ? Object.keys(transformedRows[0]) : [];

        console.log(`Transformation complete: ${transformedRows.length} rows, previewOnly=${previewOnly}`);
        
        setOutputData({
          headers,
          rows: transformedRows,
          preview: transformedRows.slice(0, 10),
          totalRows: transformedRows.length
        });

        if (!previewOnly) {
          setIsFullTransformation(true);
          setVerificationRound(0);
        } else {
          setIsFullTransformation(false);
        }

        return { success: true, transformedRows };
      } else {
        throw new Error(result.error || 'Transformation failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transformation failed';
      return { success: false, error: errorMessage };
    }
  }, []);

  const verifyTransformation = useCallback(async (
    sampleOutput: Record<string, any>[],
    inputData: CSVData,
    recentMessages: any[],
    outputFormat: string,
    customMetadata: string
  ): Promise<{ verified: boolean; feedback?: string }> => {
    if (verificationRound >= MAX_VERIFICATION_ROUNDS) {
      return { verified: true };
    }

    try {
      const limitedHeaders = inputData.headers.slice(0, 10);
      const hasMoreColumns = inputData.headers.length > 10;
      const columnsInfo = hasMoreColumns 
        ? `${limitedHeaders.join(', ')} (and ${inputData.headers.length - 10} more columns)`
        : limitedHeaders.join(', ');
      
      const csvContext = {
        totalRows: inputData.totalRows,
        columns: columnsInfo,
        outputFormat: outputFormat,
        customMetadata: outputFormat === 'custom' && customMetadata ? customMetadata.substring(0, 2000) : undefined
      };

      const conversationContext = recentMessages.slice(-4).map(m => ({
        role: m.role,
        content: m.content
      }));

      const verificationResult = await chatApi.verifyOutput(
        sampleOutput,
        conversationContext,
        csvContext
      );

      const verification = verificationResult.verification.trim();

      if (verification === 'VERIFIED') {
        console.log('Output verified successfully');
        setVerificationRound(0);
        return { verified: true };
      } else {
        console.log('Verification failed, requesting fix:', verification);
        setVerificationRound(prev => prev + 1);
        return { verified: false, feedback: verification };
      }
    } catch (err) {
      console.error('Verification error:', err);
      return { verified: true }; // Don't block on verification errors
    }
  }, [verificationRound, MAX_VERIFICATION_ROUNDS]);

  const reset = useCallback(() => {
    setOutputData(null);
    setTransformCode(null);
    setIsFullTransformation(false);
    setVerificationRound(0);
  }, []);

  return {
    outputData,
    transformCode,
    isFullTransformation,
    verificationRound,
    setTransformCode,
    setIsFullTransformation,
    executeTransformation,
    verifyTransformation,
    reset
  };
}
