import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

/**
 * Transforms `[n]` citation markers into clickable links that scroll
 * to the corresponding reference in the sidebar.
 */
function transformCitations(text) {
  if (!text) return text;
  return text.replace(/\[(\d+)\]/g, (match, num) => {
    return `<a href="#ref-${num}" class="text-indigo-600 hover:text-indigo-800 font-medium text-sm" title="Reference ${num}">[${num}]</a>`;
  });
}

export default function FormattedMarkdown({ content, className = '' }) {
  if (!content) return null;
  const transformed = transformCitations(content);

  return (
    <ReactMarkdown
      className={`prose prose-sm max-w-none ${className}`}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
    >
      {transformed}
    </ReactMarkdown>
  );
}
