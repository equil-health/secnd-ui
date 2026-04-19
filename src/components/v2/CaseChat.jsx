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

        {/* Empty state — quieter, brand-consistent */}
        {isEmpty && (
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-5 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 mb-2">
                Case-aware chat
              </div>
              <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                Grounded to this case's verified report.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {['Why this diagnosis?', 'Explain the treatment hold', 'Most urgent workup?', 'Evidence quality?'].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                    className="text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-900 hover:text-white border border-slate-200 hover:border-slate-900 px-2.5 py-1 rounded-md transition"
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
                <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-br-sm shadow-sm'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
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
                <div className="rounded-xl rounded-bl-sm bg-white border border-slate-200 px-4 py-3">
                  {chatQueuePosition > 0 ? (
                    <p className="text-xs text-amber-700 font-medium">Pipeline busy — queue position #{chatQueuePosition}</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
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
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex-shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 transition">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatStreaming ? 'Waiting for response...' : 'Ask about the report…'}
            disabled={chatStreaming}
            rows={1}
            className="flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:text-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatStreaming}
            className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 transition flex-shrink-0"
            title="Send"
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
