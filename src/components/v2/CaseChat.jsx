import { useState, useRef, useEffect } from 'react';
import FormattedMarkdown from '../../utils/formatReport';
import useSdssV2Store from '../../stores/sdssV2Store';
import { chatCompletion } from '../../utils/sdssV2Api';

export default function CaseChat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const caseId = useSdssV2Store((s) => s.caseId);
  const chatMessages = useSdssV2Store((s) => s.chatMessages);
  const chatStreaming = useSdssV2Store((s) => s.chatStreaming);
  const chatStreamContent = useSdssV2Store((s) => s.chatStreamContent);
  const chatQueuePosition = useSdssV2Store((s) => s.chatQueuePosition);
  const addChatMessage = useSdssV2Store((s) => s.addChatMessage);
  const setChatStreaming = useSdssV2Store((s) => s.setChatStreaming);
  const appendChatChunk = useSdssV2Store((s) => s.appendChatChunk);
  const finalizeChatStream = useSdssV2Store((s) => s.finalizeChatStream);
  const setChatQueuePosition = useSdssV2Store((s) => s.setChatQueuePosition);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatStreamContent]);

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

    // Build messages array for the API
    const apiMessages = [
      ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    setChatStreaming(true);
    try {
      const response = await chatCompletion(caseId, apiMessages);

      // Check for queue position header
      const queuePos = response.headers?.get?.('X-SECND-Queue-Position');
      if (queuePos) setChatQueuePosition(parseInt(queuePos, 10));

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices?.[0]?.delta?.content;
            if (chunk) appendChatChunk(chunk);
          } catch {
            // Skip malformed chunks
          }
        }
      }

      finalizeChatStream();
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

  return (
    <div className="flex flex-col h-full">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chatMessages.length === 0 && !chatStreaming && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">
              Ask questions about the report — diagnosis rationale, evidence quality, treatment implications, additional workup.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {['Why this diagnosis?', 'Explain the treatment hold', 'What workup is most urgent?', 'Evidence quality assessment'].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-full transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Streaming */}
        {chatStreaming && chatStreamContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 text-gray-800 px-4 py-2.5 text-sm">
              <FormattedMarkdown content={chatStreamContent} />
              <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
            </div>
          </div>
        )}

        {chatStreaming && !chatStreamContent && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3">
              {chatQueuePosition > 0 ? (
                <p className="text-xs text-amber-600">Pipeline busy — queue position #{chatQueuePosition}</p>
              ) : (
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3">
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
