import { useState, useRef, useEffect } from 'react';
import FormattedMarkdown from '../../utils/formatReport';
import useSdssV2Store from '../../stores/sdssV2Store';
import { chatCompletion } from '../../utils/sdssV2Api';

export default function CaseChat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const textareaRef = useRef(null);

  const caseId = useSdssV2Store((s) => s.caseId);
  const chatMessages = useSdssV2Store((s) => s.chatMessages);
  const chatStreaming = useSdssV2Store((s) => s.chatStreaming);
  const chatQueuePosition = useSdssV2Store((s) => s.chatQueuePosition);
  const addChatMessage = useSdssV2Store((s) => s.addChatMessage);
  const setChatStreaming = useSdssV2Store((s) => s.setChatStreaming);
  const setChatQueuePosition = useSdssV2Store((s) => s.setChatQueuePosition);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [input]);

  async function handleSend() {
    const text = input.trim();
    if (!text || chatStreaming) return;

    addChatMessage({ role: 'user', content: text });
    setInput('');

    const apiMessages = [
      ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    setChatStreaming(true);
    try {
      const { content, queuePosition } = await chatCompletion(caseId, apiMessages);

      if (queuePosition) setChatQueuePosition(queuePosition);

      addChatMessage({ role: 'assistant', content });
      setChatStreaming(false);
      setChatQueuePosition(0);
    } catch (err) {
      setChatStreaming(false);
      addChatMessage({
        role: 'assistant',
        content: `**Error:** ${err.message}`,
      });
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isEmpty = chatMessages.length === 0 && !chatStreaming;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable messages area — flex-col-reverse keeps content anchored to bottom */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto flex flex-col"
      >
        {/* Spacer pushes content to bottom when few messages */}
        <div className="flex-1" />

        {/* Empty state — centered above input */}
        {isEmpty && (
          <div className="px-4 pb-4">
            <div className="bg-indigo-50/50 rounded-xl px-4 py-5 text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Ask about the diagnosis, evidence, treatment holds, or next steps.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {['Why this diagnosis?', 'Explain the treatment hold', 'Most urgent workup?', 'Evidence quality?'].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                    className="text-[11px] text-indigo-600 bg-white hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-full transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {!isEmpty && (
          <div className="px-4 py-3 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <FormattedMarkdown content={msg.content} />
                  )}
                </div>
              </div>
            ))}

            {/* Waiting indicator */}
            {chatStreaming && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3">
                  {chatQueuePosition > 0 ? (
                    <p className="text-xs text-amber-600">Pipeline busy — queue position #{chatQueuePosition}</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[10px] text-gray-400">Thinking...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input — always visible at bottom */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-gray-300 bg-gray-50 px-3 py-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatStreaming ? 'Waiting for response...' : 'Ask about the report...'}
            disabled={chatStreaming}
            rows={1}
            className="flex-1 resize-none bg-transparent py-1.5 text-sm focus:outline-none disabled:text-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatStreaming}
            className="p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white disabled:text-gray-400 transition flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
