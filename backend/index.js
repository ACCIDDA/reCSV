// Single-file backend for CSV Reformatter
// Deploy directly to Google Cloud Run
// Environment variable required: OPENROUTER_API_KEY

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get Hubverse metadata
app.get('/api/metadata/hubverse', (req, res) => {
  try {
    const metadataPath = path.join(__dirname, 'hubverse-target-data.md');
    const metadata = fs.readFileSync(metadataPath, 'utf-8');
    res.json({ 
      format: 'hubverse',
      content: metadata 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to load hubverse metadata',
      message: error.message 
    });
  }
});

// System prompt for CSV transformation assistant
// **EDIT THIS PROMPT TO CUSTOMIZE THE ASSISTANT'S BEHAVIOR**
const SYSTEM_PROMPT = `You are a helpful CSV transformation assistant. You're helping someone convert their CSV data to a different format.
This may include dropping some data. The input and output maybe of very different format.

IMPORTANT: Your user has NO coding background. Use simple, clear language. Never use technical jargon or programming terms.

Your conversation flow:
1. When the user first uploads a file, YOU start by greeting them and asking what format they want to convert to
2. Ask ONE simple question at a time to understand their needs. Your response must be VERY SHORT (3-4 sentences, not including the code)
3. Be friendly and encouraging
4. When you have enough information, generate the transformation code
5. After generating the code, check yourself if it meets the output format and requirements strictly. The output format may be case-sensitive.
6. User will provide feedback on the generated code

When generating transformation code:
- You have access to 'row' (current row), 'index' (row number), and 'rows' (all input data)
- Return whatever structure makes sense for the transformation
- Output can have ANY number of rows - more, fewer, or same as input

Common patterns (use these as inspiration, not limitations):

**Simple 1:1 transformation:**
\`\`\`javascript
return {
  target_end_date: row['date_column'],
  location: row['location_column'],
  observation: parseInt(row['value_column'])
};
\`\`\`

**Expanding rows (unpivoting, adjacency→edge list, etc):**
\`\`\`javascript
const results = [];
for (let col of Object.keys(row).slice(1)) {
  if (row[col]) {
    results.push({ source: row['Node'], target: row[col] });
  }
}
return results; // Array = multiple output rows per input
\`\`\`

**Processing all data (filtering, aggregation, complex logic):**
\`\`\`javascript
return rows
  .filter(row => row['value'] > 100)
  .map(row => ({ date: row['date'], value: row['value'] }));
\`\`\`

Generate the code that solves the user's specific problem. Be creative!

`;

// Summarization endpoint
app.post('/api/summarize', async (req, res) => {
  try {
    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenRouter API key not configured' 
      });
    }

    const { pastSummary, recentMessages, model = 'anthropic/claude-3.5-sonnet' } = req.body;

    if (!recentMessages || !Array.isArray(recentMessages)) {
      return res.status(400).json({ 
        error: 'Invalid request: recentMessages array required' 
      });
    }

    // Build summarization prompt
    const summaryPrompt = pastSummary 
      ? `Previous summary: ${pastSummary}\n\nNew messages to summarize:\n${JSON.stringify(recentMessages, null, 2)}`
      : `Summarize the following conversation messages:\n${JSON.stringify(recentMessages, null, 2)}`;

    const messages = [
      { 
        role: 'system', 
        content: 'You are a conversation summarizer. Create a concise summary of the conversation that preserves key information, decisions made, and context needed for future messages. Keep it under 200 words.' 
      },
      { role: 'user', content: summaryPrompt }
    ];

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.referer || 'http://localhost:5173',
        'X-Title': 'CSV Reformatter'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: 'OpenRouter API error',
        details: errorData 
      });
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;
    res.json({ summary });

  } catch (error) {
    console.error('Summarization error:', error);
    res.status(500).json({ 
      error: 'Failed to summarize conversation',
      message: error.message 
    });
  }
});

// Verification endpoint
app.post('/api/verify', async (req, res) => {
  try {
    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenRouter API key not configured' 
      });
    }

    const { sampleOutput, conversationContext, csvContext, model = 'anthropic/claude-3.5-sonnet' } = req.body;

    if (!sampleOutput || !conversationContext) {
      return res.status(400).json({ 
        error: 'Invalid request: sampleOutput and conversationContext required' 
      });
    }

    // Build verification prompt
    let verificationPrompt = `You are a verification assistant. Your job is to check if the output data matches the requirements discussed in the conversation. 
    **IMPORTANT***: You are only seeing a preview of the output (a small snippet). So DO NOT conclude that the output is wrong if you don't see all expected rows or missing data.

Conversation context:
${JSON.stringify(conversationContext, null, 2)}

Sample output data (first few rows):
${JSON.stringify(sampleOutput, null, 2)}`;

    if (csvContext) {
      verificationPrompt += `

Expected output format: ${csvContext.outputFormat || 'hubverse'}`;
      
      if (csvContext.outputFormat === 'hubverse') {
        try {
          const hubverseMetadataPath = path.join(__dirname, 'hubverse-target-data.md');
          const hubverseMetadata = fs.readFileSync(hubverseMetadataPath, 'utf-8');
          verificationPrompt += `

Hubverse specification:
${hubverseMetadata}`;
        } catch (error) {
          console.error('Failed to load hubverse metadata:', error);
        }
      } else if (csvContext.customMetadata) {
        verificationPrompt += `

Custom metadata:
${csvContext.customMetadata}`;
      }
    }

    verificationPrompt += `

Instructions:
1. Check if the output columns match the required format
2. Check if the data types are correct
3. Check if the transformations are applied correctly
4. If everything is correct, respond with exactly: VERIFIED
5. If there are issues, describe what is wrong in 2-3 sentences`;

    const messages = [
      { role: 'system', content: 'You are a data verification assistant. Be strict and precise.' },
      { role: 'user', content: verificationPrompt }
    ];

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.referer || 'http://localhost:5173',
        'X-Title': 'CSV Reformatter'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: 'OpenRouter API error',
        details: errorData 
      });
    }

    const data = await response.json();
    const verification = data.choices[0].message.content;
    res.json({ verification });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify output',
      message: error.message 
    });
  }
});

// Chat endpoint - proxies to OpenRouter
app.post('/api/chat', async (req, res) => {
  try {
    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenRouter API key not configured' 
      });
    }

    const { messages, model = 'anthropic/claude-3.5-sonnet', csvContext, pastSummary } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array required' 
      });
    }

    // Build system prompt with CSV context
    let systemPrompt = SYSTEM_PROMPT;
    
    if (csvContext) {
      systemPrompt += `\n\nCurrent CSV context:\n- Total rows: ${csvContext.totalRows}\n- Columns: ${csvContext.columns}\n- Output Format: ${csvContext.outputFormat || 'hubverse'}\n\nSample data (first few rows and columns):\n${csvContext.sampleData}`;
      
      // Add hubverse format specification if selected
      if (csvContext.outputFormat === 'hubverse') {
        try {
          const hubverseMetadataPath = path.join(__dirname, 'hubverse-target-data.md');
          const hubverseMetadata = fs.readFileSync(hubverseMetadataPath, 'utf-8');
          systemPrompt += `\n\nHubverse Output Format Specification:\n${hubverseMetadata}`;
        } catch (error) {
          console.error('Failed to load hubverse metadata:', error);
        }
      }
      
      // Add custom metadata if provided
      if (csvContext.customMetadata) {
        systemPrompt += `\n\nCustom Output Metadata:\n${csvContext.customMetadata}`;
      }
    }

    // Build messages array with system prompt and optional past summary
    const messagesWithSystem = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add past conversation summary as assistant message if available
    if (pastSummary) {
      messagesWithSystem.push({
        role: 'assistant',
        content: `Previous conversation summary: ${pastSummary}`
      });
    }
    
    // Add current conversation messages
    messagesWithSystem.push(...messages);

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.referer || 'http://localhost:5173',
        'X-Title': 'CSV Reformatter'
      },
      body: JSON.stringify({
        model,
        messages: messagesWithSystem,
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: 'OpenRouter API error',
        details: errorData 
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 OpenRouter API Key: ${OPENROUTER_API_KEY ? '✅ Configured' : '❌ Missing'}`);
});
