/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import katex from 'katex';

interface LatexRendererProps {
  text: string;
}

export const LatexRenderer: React.FC<LatexRendererProps> = ({ text }) => {
  const renderedContent = useMemo(() => {
    if (!text) return '';

    const tokens: { type: 'text' | 'inline-math' | 'block-math'; content: string }[] = [];
    let i = 0;
    const len = text.length;

    // Helper to check if a backslash escapes the char
    const isEscaped = (pos: number): boolean => {
      let count = 0;
      let p = pos - 1;
      while (p >= 0 && text[p] === '\\') {
        count++;
        p--;
      }
      return count % 2 === 1;
    };

    while (i < len) {
      // Check for block math \[ ... \]
      if (text.startsWith('\\[', i)) {
        const endIdx = text.indexOf('\\]', i + 2);
        if (endIdx !== -1) {
          tokens.push({ type: 'block-math', content: text.substring(i + 2, endIdx) });
          i = endIdx + 2;
          continue;
        }
      }

      // Check for block math $$ ... $$
      if (text.startsWith('$$', i)) {
        const endIdx = text.indexOf('$$', i + 2);
        if (endIdx !== -1) {
          tokens.push({ type: 'block-math', content: text.substring(i + 2, endIdx) });
          i = endIdx + 2;
          continue;
        }
      }

      // Check for inline math $ ... $
      if (text[i] === '$' && !isEscaped(i)) {
        const endIdx = text.indexOf('$', i + 1);
        // Ensure the end is not escaped either
        if (endIdx !== -1 && !isEscaped(endIdx)) {
          tokens.push({ type: 'inline-math', content: text.substring(i + 1, endIdx) });
          i = endIdx + 1;
          continue;
        }
      }

      // Read plain text segment
      let plainCharStart = i;
      while (i < len) {
        if (text.startsWith('\\[', i) || text.startsWith('$$', i) || (text[i] === '$' && !isEscaped(i))) {
          break;
        }
        i++;
      }
      tokens.push({ type: 'text', content: text.substring(plainCharStart, i) });
    }

    return tokens.map((token, idx) => {
      if (token.type === 'inline-math') {
        try {
          const html = katex.renderToString(token.content, { displayMode: false, throwOnError: false });
          return (
            <span 
              key={idx} 
              dangerouslySetInnerHTML={{ __html: html }} 
              className="inline-block px-0.5 max-w-full overflow-x-auto align-middle"
            />
          );
        } catch (e) {
          return <span key={idx} className="text-red-500 font-mono bg-red-50 px-1 rounded">${token.content}$</span>;
        }
      } else if (token.type === 'block-math') {
        try {
          const html = katex.renderToString(token.content, { displayMode: true, throwOnError: false });
          return (
            <div 
              key={idx} 
              dangerouslySetInnerHTML={{ __html: html }} 
              className="my-3 py-2 bg-slate-50/50 rounded overflow-x-auto block-math"
            />
          );
        } catch (e) {
          return <pre key={idx} className="text-red-500 font-mono bg-red-50 p-2 rounded overflow-x-auto text-xs my-2">\[{token.content}\]</pre>;
        }
      } else {
        // Plain text sanitization of LaTeX escapes:
        // Replace \\ line endings, \$ with $, \% with %, \& with &, \{ with {, \} with }
        const sanitized = token.content
          .replace(/\\\\\s*$/gm, '\n') // LaTeX newlines
          .replace(/\\\\\s*/g, '\n')
          .replace(/\\\$/g, '$')
          .replace(/\\%/g, '%')
          .replace(/\\&/g, '&')
          .replace(/\\{/g, '{')
          .replace(/\\}/g, '}');

        return <span key={idx} className="whitespace-pre-line leading-relaxed">{sanitized}</span>;
      }
    });
  }, [text]);

  return <div className="leading-relaxed text-gray-800 dark:text-gray-200 select-text font-sans">{renderedContent}</div>;
};
export default LatexRenderer;
