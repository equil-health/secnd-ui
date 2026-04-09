import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useMedChat from '../hooks/useMedChat';
import useChatStore from '../stores/chatStore';
import ChatMessage from '../components/ChatMessage';
import UserBadge from '../components/UserBadge';
import FormattedMarkdown from '../utils/formatReport';
import { sdssGetTask } from '../utils/api';


export default function ChatPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { messages, sendMessage, isStreaming, streamingContent, stopStreaming } = useMedChat();
  const { reportContext, setReportContext, clearReportContext, clearChat } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Load report context if taskId is present
  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await sdssGetTask(taskId);
        if (cancelled) return;
        const result = data.result || {};
        setReportContext({
          taskId,
          topDiagnosis: result.top_diagnosis || '',
          synthesis: result.synthesis || '',
        });
      } catch {
        // Report not found or error — proceed without context
      }
    })();
    return () => { cancelled = true; };
  }, [taskId, setReportContext]);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  function handleSend() {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleNewChat() {
    clearChat();
    if (taskId) navigate('/chat');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">SECND Chat</h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Medical AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            New Chat
          </button>
          <UserBadge />
        </div>
      </div>

      {/* Report context banner */}
      {reportContext && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.03a4.5 4.5 0 00-6.364-6.364L4.5 8.257" />
            </svg>
            <span className="text-sm text-indigo-700">
              Chatting about: <strong>{reportContext.topDiagnosis || 'SDSS Report'}</strong>
            </span>
          </div>
          <button onClick={clearReportContext} className="text-xs text-indigo-500 hover:text-indigo-700 transition">
            Dismiss
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center mb-6">
            <p className="text-xs text-amber-700">
              AI-generated medical information for research and educational purposes only.
              Not a substitute for clinical judgment. Always consult a qualified healthcare professional.
            </p>
          </div>

          {/* Empty state */}
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Ask a clinical question</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {reportContext
                  ? `Ask follow-up questions about the ${reportContext.topDiagnosis || 'clinical case'} analysis.`
                  : 'Describe a clinical case or ask a medical question to get an AI-powered second opinion.'}
              </p>
              {!reportContext && (
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {[
                    'Differential diagnosis for acute chest pain in a 45yo male',
                    'Interpret elevated troponin with normal ECG',
                    'Workup for unexplained weight loss in elderly',
                  ].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                      className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-gray-100 text-gray-800 px-4 py-2.5 text-sm">
                <FormattedMarkdown content={streamingContent} />
                <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
              </div>
            </div>
          )}

          {/* Streaming indicator (no content yet) */}
          {isStreaming && !streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Waiting for response...' : 'Type a clinical question...'}
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400"
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition flex-shrink-0"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium transition flex-shrink-0"
            >
              Send
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-1.5 max-w-3xl mx-auto">
          Enter to send &middot; Shift+Enter for new line &middot; Powered by MedGemma
        </p>
      </div>
    </div>
  );
}
