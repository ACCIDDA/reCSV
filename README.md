# CSV Reformatter

AI-powered CSV transformation tool for non-technical users. Chat naturally about your data transformation needs, and the AI generates the code for you. Built with complete privacy - your data never leaves your machine.

## Features

- 🔒 **Privacy-First**: All CSV processing happens in your browser
- 💬 **Conversational AI**: Just describe what you want in plain English
- 🔍 **Auto-verification**: AI checks its own output and self-corrects
- 📱 **PWA**: Install as desktop/mobile app, works offline
- 🚀 **Fast**: Processes large files efficiently in browser
- 🎯 **Format Support**: Hubverse and custom output formats

## Architecture

```
Browser (Frontend)
├─ File Upload & CSV Parsing
├─ Preview & Chat Interface  
├─ Web Worker (Sandboxed Transformation)
└─ Download Results
      ↓ (Only chat messages)
Cloud Run (Backend)
└─ OpenRouter API Proxy
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- OpenRouter API key ([get one here](https://openrouter.ai/))

### 1. Backend Setup

```bash
cd backend
npm install

# Create .env file
echo "OPENROUTER_API_KEY=your_key_here" > .env

# Start backend
npm run dev
```

Backend runs on `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend
npm install

# Start frontend
npm run dev
```

Frontend runs on `http://localhost:5173`

### 3. Use the App

1. Open http://localhost:5173
2. Upload a CSV file
3. Chat with the AI to define your transformation
4. Preview the results
5. Download transformed data

## Deployment

### Backend (Google Cloud Run)

1. **Copy the single file**:
   ```bash
   # backend/index.js is self-contained
   # Just copy and paste it into Cloud Run
   ```

2. **In Google Cloud Console**:
   - Create new Cloud Run service
   - Select "Deploy from source code"
   - Paste `backend/index.js` content
   - Add environment variable: `OPENROUTER_API_KEY`
   - Deploy!

3. **Note the URL** (e.g., `https://your-app-xxxxx.run.app`)

### Frontend (Vercel/Netlify)

**Vercel:**
```bash
cd frontend
npm install -g vercel
vercel --prod
```

**Netlify:**
```bash
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

**Configure API URL:**
Create `frontend/.env.production`:
```
VITE_API_URL=https://your-cloud-run-url.run.app/api
```

## How It Works

### 1. File Upload
- User selects CSV file (stays in browser memory)
- Configurable: headers detection, output format selection
- No data sent to server

### 2. AI Conversation
- **Agent-initiated**: AI greets you and asks about your needs
- Describe transformations in plain language
- **Limited context sent**: Only 7 columns × 3 rows sample + recent messages (token-optimized)
- AI generates JavaScript transformation code automatically

### 3. Automatic Preview & Verification
- Code executes in sandboxed Web Worker (first 10 rows)
- **Self-verification**: AI checks if output matches requirements
- **Auto-correction**: If verification fails, AI fixes the code (max 2 rounds)
- Preview shown instantly

### 4. Full Transformation
- Click "Transform All" to process entire dataset
- Handles any input→output row ratio (expansion, filtering, 1:1)
- All processing in browser - server never sees data

### 5. Download
- Download preview (10 rows) or full transformed dataset
- Separate buttons for clarity
- CSV format ready to use

## Configuration

### Environment Variables

**Backend (.env):**
```bash
OPENROUTER_API_KEY=your_key_here
PORT=3001  # Optional, defaults to 3001
```

**Frontend (.env.development):**
```bash
VITE_API_URL=http://localhost:3001/api
VITE_MODEL=qwen/qwen3-vl-235b-a22b-instruct  # Or any OpenRouter model
VITE_MAX_VERIFICATION_ROUNDS=2
```

### Customization

**System Prompt** (`backend/index.js` lines 43-105):
- Edit to change AI behavior
- Currently optimized for non-technical users
- Includes transformation patterns as examples

**Token Limits** (search for "slice" in codebase):
- Greeting: 7 columns × 3 rows
- Chat messages: 7 columns × 3 rows
- Verification: 10 columns × 10 rows, 4 messages
- Custom metadata: 2000 chars max

**Conversation Management:**
- Max recent messages: 8 (then auto-summarizes)
- Summarization preserves context while reducing tokens

## Development

### Project Structure

```
reformatter/
├─ backend/
│  ├─ index.js                    # Single-file Express server
│  ├─ hubverse-target-data.md    # Hubverse format spec
│  └─ package.json
├─ frontend/
│  ├─ src/
│  │  ├─ components/             # UI components (FileUpload, ChatInterface, DataPreview)
│  │  ├─ hooks/                  # Custom hooks (useCSVParser, useConversation, useTransformation)
│  │  ├─ utils/                  # TransformWorker (sandboxed execution)
│  │  ├─ api/                    # Backend communication (chat, verify, summarize)
│  │  └─ types/                  # TypeScript types
│  ├─ vite.config.ts            # Vite + PWA config
│  └─ package.json
└─ README.md
```

### Key Technologies

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express (single file for Cloud Run)
- **CSV Processing**: PapaParse
- **AI**: OpenRouter (configurable model, default: qwen/qwen3-vl-235b-a22b-instruct)
- **PWA**: vite-plugin-pwa
- **State Management**: Custom hooks for clean separation of concerns

## PWA Features

Once deployed, users can:
- Click "Install App" in browser
- Use offline after first visit
- Access from desktop/home screen
- Works like native app

## Security

### Sandboxed Execution
Web Workers cannot access:
- ❌ Network (fetch, axios)
- ❌ DOM (document, window)
- ❌ localStorage/cookies
- ❌ File system

They can only:
- ✅ Transform data passed to them
- ✅ Run pure JavaScript functions

### Data Privacy
- CSV files never uploaded to server
- Only limited sample data sent to AI:
  - First 7 columns only (with count of remaining)
  - First 3 rows for context
  - Last 4 conversation messages
  - Custom metadata truncated to 2000 chars
- Full transformation happens in browser
- Token-optimized to reduce costs and exposure

## Troubleshooting

**Backend won't start:**
- Check Node.js version (18+)
- Verify `.env` file exists with valid API key

**Frontend compilation errors:**
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf dist`

**Transformation fails:**
- Check browser console for errors (look for "Transformation complete" logs)
- Auto-verification should catch and fix most issues
- If AI generates wrong pattern, clarify in chat (e.g., "each row should become multiple rows")
- Verification runs automatically on preview, max 2 correction attempts

**Transform All button missing:**
- Make sure preview transformation completed successfully first
- Button appears when code is generated and preview exists
- Check for errors in browser console

**Wrong number of output rows:**
- AI might generate wrong transformation pattern
- Tell AI explicitly: "expand each row" or "filter rows" or "one-to-one mapping"
- System supports any input→output ratio

**PWA not installing:**
- Must use HTTPS (or localhost)
- Check service worker registration in DevTools
- Verify manifest.json is accessible

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
