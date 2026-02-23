import React from 'react';

interface MarkdownContentProps {
    content: string;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
    if (!content) return null;

    // Step 1: Handle code blocks (triple backticks)
    // We'll replace them with a special marker to avoid other regex interfering
    const codeBlocks: string[] = [];
    let processedContent = content.replace(/```(?:(\w+)\s+)?([\s\S]+?)```/g, (match, lang, code) => {
        const id = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(`
      <div class="my-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
        ${lang ? `<div class="bg-slate-100 dark:bg-slate-800 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700">${lang}</div>` : ''}
        <pre class="p-4 bg-slate-50 dark:bg-slate-900/50 overflow-x-auto text-xs font-mono text-slate-700 dark:text-slate-300"><code>${code.trim()}</code></pre>
      </div>
    `);
        return id;
    });

    // Step 2: Basic Markdown transformations
    processedContent = processedContent
        .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-inherit mt-4 mb-2">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-inherit mt-5 mb-3">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-inherit mt-6 mb-4">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-inherit">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em class="italic opacity-80">$1</em>')
        .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc mb-1">$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal mb-1">$2</li>');

    // Step 3: Paragraphs and Line Breaks
    // Split by double newline to create paragraphs
    const paragraphs = processedContent.split(/\n\n+/);
    let html = paragraphs
        .map(p => {
            // If the paragraph is just a code block marker, don't wrap in <p>
            if (p.trim().startsWith('__CODE_BLOCK_') && p.trim().endsWith('__')) {
                return p;
            }
            return `<p class="mb-3 last:mb-0 leading-relaxed">${p.replace(/\n/g, '<br/>')}</p>`;
        })
        .join('');

    // Step 4: Restore code blocks
    codeBlocks.forEach((block, i) => {
        html = html.replace(`__CODE_BLOCK_${i}__`, block);
    });

    return (
        <div
            className="markdown-content text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};

export default MarkdownContent;
