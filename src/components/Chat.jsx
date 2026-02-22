import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../stores/appStore';
import useChat from '../hooks/useChat';
import ChatMessage from './ChatMessage';

export default function Chat() {
  const { messages, sendFollowup } = useChat();
  const { activeCase, setFormOpen } = useAppStore();
  const [input, setInput] = useState('');
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
            <button
              onClick={() => setFormOpen(true)}
              className="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
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
