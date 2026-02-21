import { useCallback } from 'react';
import useAppStore from '../stores/appStore';
import { submitFollowup } from '../utils/api';

/**
 * Manages the chat message array and follow-up submissions.
 */
export default function useChat() {
  const { activeCase, messages, addMessage } = useAppStore();

  const sendFollowup = useCallback(
    async (question) => {
      if (!activeCase?.id || !question.trim()) return;
      addMessage({ role: 'user', content: question, ts: new Date().toISOString() });
      try {
        const res = await submitFollowup(activeCase.id, question);
        addMessage({
          role: 'ai',
          content: res.answer,
          ts: res.created_at,
        });
      } catch (err) {
        addMessage({
          role: 'ai',
          content: `Error: ${err.message}`,
          ts: new Date().toISOString(),
          error: true,
        });
      }
    },
    [activeCase, addMessage],
  );

  return { messages, sendFollowup };
}
