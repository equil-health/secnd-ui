import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../stores/appStore';
import useChat from '../hooks/useChat';
import ChatMessage from './ChatMessage';
import UserBadge from './UserBadge';

export default function Chat() {
  const { messages, sendFollowup } = useChat();
  const { activeCase, setFormOpen } = useAppStore();
  const [input, setInput] = useState('');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendFollowup(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <h1 className="text-lg font-semibold text-indigo-700">SECND Opinion</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFormOpen(true)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            New Case
          </button>
          <Link
            to="/submit"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Upload
          </Link>
          <Link
            to="/history"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            History
          </Link>
          <UserBadge />
        </div>
      </header>

      {/* Message list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !activeCase && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <p className="text-4xl mb-3">🩺</p>
            <p className="text-lg font-medium">Welcome to SECND Opinion</p>
            <p className="text-sm mt-1">
              Submit a medical case to get an AI-powered second opinion with cited evidence.
            </p>
            <div className="mt-6 max-w-md text-left bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-xs text-amber-800 leading-relaxed mb-3">
                By using this portal and uploading data, you acknowledge that you have read, understood, and agree to be bound by the Critical Disclaimer, Terms of Use, and the probabilistic nature of the SECND AI reports.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={disclaimerAccepted}
                  onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                  className="mt-0.5 accent-indigo-600"
                />
                <span className="text-xs text-amber-900 font-medium">
                  I accept the SECND Disclaimer and acknowledge this is a research prototype.
                </span>
              </label>
            </div>
            <button
              onClick={() => setFormOpen(true)}
              disabled={!disclaimerAccepted}
              className="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              New Case
            </button>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
      </div>

      {/* Input area — only show when a case is active and pipeline is done */}
      {activeCase && (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-4 py-3 border-t bg-white"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up question..."
            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
