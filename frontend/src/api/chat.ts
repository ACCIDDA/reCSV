const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const MODEL = import.meta.env.VITE_MODEL || 'anthropic/claude-3.5-sonnet';

export const chatApi = {
  async sendMessage(messages: { role: string; content: string }[], csvContext?: any, pastSummary?: string) {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model: MODEL,
        csvContext,
        pastSummary
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    return response.json();
  },

  async summarizeConversation(pastSummary: string, recentMessages: { role: string; content: string }[]) {
    const response = await fetch(`${API_BASE_URL}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pastSummary,
        recentMessages,
        model: MODEL
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to summarize conversation');
    }

    return response.json();
  },

  async verifyOutput(sampleOutput: any[], conversationContext: { role: string; content: string }[], csvContext?: any) {
    const response = await fetch(`${API_BASE_URL}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sampleOutput,
        conversationContext,
        csvContext,
        model: MODEL
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify output');
    }

    return response.json();
  },

  async getHubverseMetadata() {
    const response = await fetch(`${API_BASE_URL}/metadata/hubverse`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch Hubverse metadata');
    }

    return response.json();
  }
};
