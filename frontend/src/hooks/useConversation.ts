import { useState, useCallback } from 'react';
import { CSVData, Message } from '../types';
import { chatApi } from '../api/chat';

export function useConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [pastSummary, setPastSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const MAX_RECENT_MESSAGES = 8;

  const buildLimitedCSVContext = useCallback((data: CSVData, outputFormat: string, customMetadata: string, columnLimit = 7, rowLimit = 3) => {
    const limitedHeaders = data.headers.slice(0, columnLimit);
    const hasMoreColumns = data.headers.length > columnLimit;
    const columnsInfo = hasMoreColumns 
      ? `${limitedHeaders.join(', ')} (and ${data.headers.length - columnLimit} more columns)`
      : limitedHeaders.join(', ');
    
    const limitedSampleData = data.preview.slice(0, rowLimit).map(row => {
      const limitedRow: Record<string, any> = {};
      limitedHeaders.forEach(header => {
        limitedRow[header] = row[header];
      });
      return limitedRow;
    });
    
    return {
      totalRows: data.totalRows,
      columns: columnsInfo,
      sampleData: JSON.stringify(limitedSampleData, null, 2),
      outputFormat: outputFormat,
      customMetadata: outputFormat === 'custom' ? customMetadata : undefined
    };
  }, []);

  const triggerAgentGreeting = useCallback(async (
    data: CSVData,
    outputFormat: string,
    customMetadata: string
  ) => {
    if (!data) return;

    setIsLoading(true);

    try {
      const csvContext = buildLimitedCSVContext(data, outputFormat, customMetadata);
      const response = await chatApi.sendMessage([], csvContext, '');
      const assistantMessage = response.choices[0].message.content;

      const newAssistantMessage: Message = { 
        role: 'assistant', 
        content: assistantMessage 
      };
      setMessages([newAssistantMessage]);
      setRecentMessages([newAssistantMessage]);
      setPastSummary('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start conversation';
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [buildLimitedCSVContext]);

  const sendMessage = useCallback(async (
    userMessage: string,
    inputData: CSVData,
    outputFormat: string,
    customMetadata: string
  ) => {
    const newUserMessage: Message = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setRecentMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      let currentPastSummary = pastSummary;
      let messagesToSend = [...recentMessages, newUserMessage];
      
      if (recentMessages.length >= MAX_RECENT_MESSAGES) {
        const summaryResponse = await chatApi.summarizeConversation(pastSummary, recentMessages);
        currentPastSummary = summaryResponse.summary;
        setPastSummary(currentPastSummary);
        messagesToSend = [newUserMessage];
        setRecentMessages([newUserMessage]);
      }
      
      const csvContext = buildLimitedCSVContext(inputData, outputFormat, customMetadata);
      
      const response = await chatApi.sendMessage(
        messagesToSend.map(m => ({ role: m.role, content: m.content })),
        csvContext,
        currentPastSummary
      );
      const assistantMessage = response.choices[0].message.content;

      const newAssistantMessage: Message = { 
        role: 'assistant', 
        content: assistantMessage 
      };
      setMessages(prev => [...prev, newAssistantMessage]);
      setRecentMessages(prev => [...prev, newAssistantMessage]);

      return { assistantMessage, currentPastSummary };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${errorMessage}`
      }]);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [recentMessages, pastSummary, buildLimitedCSVContext]);

  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      role: 'system',
      content
    }]);
  }, []);

  const addRecentMessage = useCallback((message: Message) => {
    setRecentMessages(prev => [...prev, message]);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setRecentMessages([]);
    setPastSummary('');
  }, []);

  return {
    messages,
    recentMessages,
    pastSummary,
    isLoading,
    setIsLoading,
    buildLimitedCSVContext,
    triggerAgentGreeting,
    sendMessage,
    addSystemMessage,
    addRecentMessage,
    reset
  };
}
