import { useCallback, useRef, useEffect } from 'react';
import useChatStore from '../stores/chatStore';
import { chatCompletions } from '../utils/api';

/**
 * Hook for medical chat with SSE streaming.
 * Manages sending messages, parsing the SSE stream, and updating the store.
 */
export default function useMedChat() {
  const {
    messages, isStreaming, streamingContent, reportContext,
    addMessage, setStreaming, appendStreamChunk, finalizeStream,
  } = useChatStore();

  const abortRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || isStreaming) return;

    // Add user message
    const userMsg = { role: 'user', content: content.trim(), ts: new Date().toISOString() };
    addMessage(userMsg);

    // Build API messages (OpenAI format)
    const allMessages = [...messages, userMsg];
    const apiMessages = allMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const response = await chatCompletions(apiMessages, reportContext);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ''; // Buffer for incomplete SSE lines

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              appendStreamChunk(delta);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim() && buffer.trim() !== 'data: [DONE]' && buffer.trim().startsWith('data: ')) {
        try {
          const json = JSON.parse(buffer.trim().slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) appendStreamChunk(delta);
        } catch {
          // Skip
        }
      }

      finalizeStream();
    } catch (err) {
      if (err.name === 'AbortError') return;
      addMessage({
        role: 'assistant',
        content: `Sorry, an error occurred: ${err.message}`,
        ts: new Date().toISOString(),
        error: true,
      });
      setStreaming(false);
    }
  }, [messages, isStreaming, reportContext, addMessage, setStreaming, appendStreamChunk, finalizeStream]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    finalizeStream();
  }, [finalizeStream]);

  return { messages, sendMessage, isStreaming, streamingContent, stopStreaming };
}
