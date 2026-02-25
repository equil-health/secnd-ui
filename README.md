# SECND Frontend

React single-page application for the SECND medical second opinion platform. Provides a chat-based interface for submitting clinical cases, tracking pipeline progress in real time, and viewing evidence-backed reports.

## Tech Stack

- **React 18** with JSX
- **Vite 6** for dev server and builds
- **Zustand 5** for global state management
- **Tailwind CSS 3** with typography plugin
- **React Router 6** for client-side routing
- **React Markdown** with rehype-raw and remark-gfm for report rendering
- **WebSocket** for real-time pipeline status updates

## Features

- **Chat-based interface** — submit cases, track progress, and view reports in a conversational flow
- **Structured + free-text input** — tabbed case form with structured fields or paste-in clinical notes
- **File upload** — attach PDFs, DOCX, JPG/PNG to case submissions
- **Real-time pipeline tracker** — WebSocket-driven step-by-step progress with live previews
- **Report viewer** — tabbed display (analysis, evidence, STORM) with inline citation links
- **Zebra mode** — dedicated rare disease report viewer with excluded diagnoses and zebra hypotheses
- **Research mode** — standalone literature research without patient data
- **Export** — download reports as PDF, DOCX, or standalone HTML
- **Follow-up chat** — ask questions about completed reports
- **Case history** — paginated list of all past cases

## Prerequisites

- Node.js 18+
- Backend running on `http://localhost:8000` (see [backend README](../backend/README.md))

## Setup

```bash
cd script/frontend

# Install dependencies
npm install

# Start dev server (proxies /api and /ws to backend)
npm run dev
```

The app runs at `http://localhost:5173`. Vite proxies all `/api/*` and `/ws/*` requests to the backend at port 8000.

## Build

```bash
npm run build    # Output to dist/
npm run preview  # Preview production build locally
```

## Project Structure

```
frontend/
├── index.html              # HTML template
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite config with API/WS proxy
├── tailwind.config.js      # Tailwind + typography plugin
├── postcss.config.js       # PostCSS config
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Router (/, /submit, /history, /case/:id, /research)
    ├── index.css           # Global styles + Tailwind directives
    ├── components/
    │   ├── Chat.jsx            # Chat interface (header + messages + input)
    │   ├── ChatMessage.jsx     # User/AI message bubbles
    │   ├── CaseForm.jsx        # Case submission modal (structured + free-text tabs)
    │   ├── PipelineTracker.jsx # Real-time step progress timeline
    │   ├── ReportViewer.jsx    # Standard report viewer (3 tabs)
    │   ├── ZebraReportViewer.jsx # Rare disease report viewer
    │   ├── ReferenceList.jsx   # Scrollable citation sidebar
    │   ├── VerdictCard.jsx     # Evidence claim verdict badge
    │   └── ExportButtons.jsx   # PDF/DOCX/HTML download buttons
    ├── pages/
    │   ├── HomePage.jsx        # Main chat-based interface
    │   ├── SubmitPage.jsx      # File upload + case submission
    │   ├── HistoryPage.jsx     # Case history list with pagination
    │   ├── ReportPage.jsx      # Standalone report display
    │   ├── ResearchPage.jsx    # Research mode interface
    │   └── LandingPage.jsx     # Marketing/landing page
    ├── hooks/
    │   ├── useWebSocket.js     # WebSocket connection + auto-reconnect
    │   ├── usePipeline.js      # WebSocket to Zustand state bridge
    │   └── useChat.js          # Follow-up message management
    ├── stores/
    │   └── appStore.js         # Zustand store (cases, reports, pipeline state)
    └── utils/
        ├── api.js              # Fetch wrapper for all API endpoints
        └── formatReport.jsx    # Markdown renderer with citation linking
```

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | HomePage | Chat-based case submission and pipeline tracking |
| `/submit` | SubmitPage | File upload and case submission form |
| `/history` | HistoryPage | Paginated list of past cases |
| `/case/:id` | ReportPage | Full report display for a completed case |
| `/research` | ResearchPage | Standalone medical research mode |

## API Proxy

Vite dev server proxies requests to the backend:

| Frontend path | Backend target |
|--------------|---------------|
| `/api/*` | `http://localhost:8000/api/*` |
| `/ws/*` | `ws://localhost:8000/ws/*` |
| `/health` | `http://localhost:8000/health` |

In production, configure your reverse proxy (nginx, Vercel, etc.) to route `/api` and `/ws` to the backend.

## State Management

The app uses a single Zustand store (`appStore.js`) with the following slices:

- **cases** — submitted case data and status
- **reports** — completed report data (analysis, evidence, references)
- **pipeline** — real-time pipeline step progress from WebSocket
- **chat** — follow-up conversation messages

The `usePipeline` hook bridges WebSocket messages to the store, updating step status and previews as they arrive.

## Key Design Decisions

- **Chat-first UX** — the main interface is conversational, not form-heavy. Users submit cases through a chat flow and receive pipeline updates as chat messages.
- **WebSocket for live updates** — `useWebSocket` handles connection lifecycle with auto-reconnect. Pipeline step updates stream in real time without polling.
- **Zustand over Redux** — simpler API, no boilerplate. Single store file with clear slices.
- **Citation linking** — `formatReport.jsx` parses `[n]` citations in markdown and renders them as clickable links that scroll to the reference list.
- **Separate report viewers** — `ReportViewer` (standard) and `ZebraReportViewer` (rare disease) have different layouts matching their content structure.
