import { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { DataPreview } from './components/DataPreview';
import { ChatInterface } from './components/ChatInterface';
import Papa from 'papaparse';
import { useCSVParser } from './hooks/useCSVParser';
import { useConversation } from './hooks/useConversation';
import { useTransformation } from './hooks/useTransformation';
import { chatApi } from './api/chat';

function App() {
  const csvParser = useCSVParser();
  const conversation = useConversation();
  const transformation = useTransformation();
  
  const [outputFormat, setOutputFormat] = useState<'hubverse' | 'custom'>('hubverse');
  const [customMetadata, setCustomMetadata] = useState<string>('');

  const handleFileLoaded = useCallback(async (file: File) => {
    const isInitialLoad = csvParser.handleFileLoaded(file);
    if (isInitialLoad && csvParser.inputData) {
      conversation.reset();
      transformation.reset();
      setTimeout(() => {
        if (csvParser.inputData) {
          conversation.triggerAgentGreeting(csvParser.inputData, outputFormat, customMetadata);
        }
      }, 500);
    }
  }, [csvParser, conversation, transformation, outputFormat, customMetadata]);

  const handleSendMessage = useCallback(async (userMessage: string) => {
    if (!csvParser.inputData) return;

    try {
      csvParser.setError(null);
      const { assistantMessage } = await conversation.sendMessage(
        userMessage,
        csvParser.inputData,
        outputFormat,
        customMetadata
      );

      // Check if response contains transformation code
      const codeMatch = assistantMessage.match(/```(?:javascript|js)?\s*\n([\s\S]+?)\n```/);
      if (codeMatch) {
        const code = codeMatch[1].trim();
        transformation.setTransformCode(code);
        transformation.setIsFullTransformation(false);
        
        console.log('Code detected, executing transformation...', code);
        
        const result = await transformation.executeTransformation(code, csvParser.inputData, true, false);
        
        if (result.success && result.transformedRows) {
          // Verify preview output
          const limitedSample = result.transformedRows.slice(0, 10).map(row => {
            const keys = Object.keys(row).slice(0, 10);
            const limitedRow: Record<string, any> = {};
            keys.forEach(key => {
              limitedRow[key] = row[key];
            });
            return limitedRow;
          });
          
          const verifyResult = await transformation.verifyTransformation(
            limitedSample,
            csvParser.inputData,
            conversation.recentMessages,
            outputFormat,
            customMetadata
          );
          
          if (!verifyResult.verified && verifyResult.feedback) {
            // Auto-fix: Send feedback back to agent
            handleVerificationFeedback(verifyResult.feedback);
          }
        } else if (result.error) {
          conversation.addSystemMessage(`❌ Transformation error: ${result.error}`);
          csvParser.setError(result.error);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      csvParser.setError(errorMessage);
    }
  }, [csvParser, conversation, transformation, outputFormat, customMetadata]);

  const handleVerificationFeedback = useCallback(async (feedback: string) => {
    if (!csvParser.inputData) return;

    // Add feedback to recent messages for context only
    conversation.addRecentMessage({
      role: 'assistant',
      content: `I checked the output and found some issues: ${feedback}\n\nLet me fix the transformation code.`
    });

    // Request fix from agent
    setTimeout(async () => {
      if (!csvParser.inputData) return;
      
      conversation.setIsLoading(true);
      try {
        const csvContext = conversation.buildLimitedCSVContext(csvParser.inputData, outputFormat, customMetadata);
        const response = await chatApi.sendMessage(
          conversation.recentMessages.map(m => ({ role: m.role, content: m.content })),
          csvContext,
          conversation.pastSummary
        );
        
        const assistantMessage = response.choices[0].message.content;
        conversation.addRecentMessage({ role: 'assistant', content: assistantMessage });
        
        const codeMatch = assistantMessage.match(/```(?:javascript|js)?\s*\n([\s\S]+?)\n```/);
        if (codeMatch) {
          const code = codeMatch[1].trim();
          transformation.setTransformCode(code);
          await transformation.executeTransformation(code, csvParser.inputData, true, true);
        }
      } catch (err) {
        console.error('Auto-fix error:', err);
      } finally {
        conversation.setIsLoading(false);
      }
    }, 500);
  }, [csvParser, conversation, transformation, outputFormat, customMetadata]);

  const handleDownloadPreview = useCallback(() => {
    if (!transformation.outputData) return;
    const csv = Papa.unparse(transformation.outputData.preview);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'transformed_preview.csv';
    link.click();
  }, [transformation.outputData]);

  const handleDownloadFull = useCallback(() => {
    if (!transformation.outputData) return;
    const csv = Papa.unparse(transformation.outputData.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'transformed_full.csv';
    link.click();
  }, [transformation.outputData]);

  const handleTransformAll = useCallback(async () => {
    if (!transformation.transformCode || !csvParser.inputData) return;
    
    conversation.setIsLoading(true);
    const result = await transformation.executeTransformation(
      transformation.transformCode,
      csvParser.inputData,
      false,
      false
    );
    
    if (result.success) {
      conversation.addSystemMessage(
        `✅ Successfully transformed all ${csvParser.inputData.totalRows.toLocaleString()} input rows into ${result.transformedRows?.length.toLocaleString()} output rows!`
      );
    } else if (result.error) {
      conversation.addSystemMessage(`❌ Transformation error: ${result.error}`);
      csvParser.setError(result.error);
    }
    conversation.setIsLoading(false);
  }, [transformation, csvParser, conversation]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">CSV Reformatter</h1>
                <p className="text-xs text-gray-500">AI-powered CSV transformation</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {csvParser.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{csvParser.error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side: File upload and input preview */}
          <div className="space-y-4">
            {!csvParser.inputData ? (
              <>
                <div className="bg-white rounded-lg shadow p-5">
                  <FileUpload onFileLoaded={handleFileLoaded} onError={csvParser.setError} />
                </div>
                
                {/* Settings Panel - Before Upload */}
                <div className="bg-white rounded-lg shadow p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Settings</h3>
                  
                  <div className="space-y-3">
                    {/* Header Checkbox */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="has-headers-before"
                        checked={csvParser.hasHeaders}
                        onChange={(e) => csvParser.setHasHeaders(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="has-headers-before" className="text-sm text-gray-700">
                        First row contains column headers
                      </label>
                    </div>
                    
                    {/* Output Format Selection */}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-600 mb-2">Output Format</div>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            value="hubverse"
                            checked={outputFormat === 'hubverse'}
                            onChange={(e) => setOutputFormat(e.target.value as 'hubverse')}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">Hubverse</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            value="custom"
                            checked={outputFormat === 'custom'}
                            onChange={(e) => setOutputFormat(e.target.value as 'custom')}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">Custom</span>
                        </label>
                      </div>
                      
                      {outputFormat === 'custom' && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Metadata
                          </label>
                          <textarea
                            value={customMetadata}
                            onChange={(e) => setCustomMetadata(e.target.value)}
                            placeholder="Paste your metadata here..."
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={5}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Settings Panel */}
                <div className="bg-white rounded-lg shadow p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Settings</h3>
                  
                  <div className="space-y-3">
                    {/* Header Checkbox */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="has-headers-after"
                        checked={csvParser.hasHeaders}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          csvParser.setHasHeaders(newValue);
                          csvParser.reParseFile();
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="has-headers-after" className="text-sm text-gray-700">
                        First row contains column headers
                      </label>
                    </div>
                    
                    {/* Output Format Selection */}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-600 mb-2">Output Format</div>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            value="hubverse"
                            checked={outputFormat === 'hubverse'}
                            onChange={(e) => setOutputFormat(e.target.value as 'hubverse')}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">Hubverse</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            value="custom"
                            checked={outputFormat === 'custom'}
                            onChange={(e) => setOutputFormat(e.target.value as 'custom')}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">Custom</span>
                        </label>
                      </div>
                      
                      {outputFormat === 'custom' && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Metadata
                          </label>
                          <textarea
                            value={customMetadata}
                            onChange={(e) => setCustomMetadata(e.target.value)}
                            placeholder="Paste your metadata here..."
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={5}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Input Data Preview */}
                <div className="bg-white rounded-lg shadow p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-semibold text-gray-900">Input Data</h2>
                    <button
                      onClick={() => {
                        csvParser.reset();
                        transformation.reset();
                        conversation.reset();
                        setOutputFormat('hubverse');
                        setCustomMetadata('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                    >
                      Upload New
                    </button>
                  </div>
                  <DataPreview
                    title="Input Preview"
                    headers={csvParser.inputData.headers}
                    rows={csvParser.inputData.preview}
                    totalRows={csvParser.inputData.totalRows}
                  />
                </div>
              </>
            )}

            {transformation.outputData && (
              <div className="bg-white rounded-lg shadow p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-semibold text-gray-900">
                    Output Data
                    {!transformation.isFullTransformation && (
                      <span className="ml-2 text-xs font-normal text-orange-600">
                        (Preview only - click Transform All)
                      </span>
                    )}
                  </h2>
                  <div className="flex space-x-2">
                    {transformation.transformCode && !transformation.isFullTransformation && (
                      <button
                        onClick={handleTransformAll}
                        disabled={conversation.isLoading}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {conversation.isLoading ? 'Transforming...' : `Transform All (${csvParser.inputData?.totalRows.toLocaleString()} rows)`}
                      </button>
                    )}
                    <button
                      onClick={handleDownloadPreview}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                    >
                      Download Preview
                    </button>
                    {transformation.transformCode && transformation.isFullTransformation && (
                      <button
                        onClick={handleDownloadFull}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                      >
                        Download Full Data ({transformation.outputData.totalRows.toLocaleString()} rows)
                      </button>
                    )}
                  </div>
                </div>
                <DataPreview
                  title="Output Preview"
                  headers={transformation.outputData.headers}
                  rows={transformation.outputData.preview}
                  totalRows={transformation.outputData.totalRows}
                />
              </div>
            )}
          </div>

          {/* Right side: Chat interface */}
          <div className="lg:sticky lg:top-6 h-[600px]">
            <div className="bg-white rounded-lg shadow h-full">
              <ChatInterface
                messages={conversation.messages}
                onSendMessage={handleSendMessage}
                isLoading={conversation.isLoading}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
