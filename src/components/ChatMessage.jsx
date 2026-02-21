import FormattedMarkdown from '../utils/formatReport';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-md'
            : message.error
              ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-md'
              : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <FormattedMarkdown content={message.content} />
        )}
        {message.ts && (
          <p
            className={`text-[10px] mt-1 ${
              isUser ? 'text-indigo-200' : 'text-gray-400'
            }`}
          >
            {new Date(message.ts).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
