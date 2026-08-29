import React, { useMemo } from 'react';

interface MarkdownContentProps {
    /** Typed as string, but it arrives from model output: never trust the type. */
    content: string;
}

/** Any model output is untrusted text — never let it reach the DOM as markup. */
const escapeHtml = (str: string): string =>
    str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

/** Only http(s) links survive — blocks javascript: and data: URLs. */
const safeUrl = (url: string): string | null => {
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
};

const renderMarkdown = (content: string): string => {
    // 1. Pull out fenced code blocks before anything else touches the text.
    const codeBlocks: string[] = [];
    let text = content.replace(/```(?:(\w+)[^\n]*)?\n?([\s\S]*?)```/g, (_m, lang, code) => {
        const id = ` CODE${codeBlocks.length} `;
        codeBlocks.push(`
      <div class="my-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        ${lang ? `<div class="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">${escapeHtml(lang)}</div>` : ''}
        <pre class="p-4 bg-slate-50 dark:bg-slate-900/60 overflow-x-auto text-xs font-mono text-slate-700 dark:text-slate-300"><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>
      </div>
    `);
        return id;
    });

    // 2. Escape everything that remains, then re-introduce only the markup we generate.
    text = escapeHtml(text);

    // Inline code
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Links: [label](url)
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
        const href = safeUrl(String(url).replace(/&amp;/g, '&'));
        return href
            ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
            : match;
    });

    // Headings, emphasis
    text = text
        .replace(/^###\s+(.+)$/gm, '<h3 class="text-base font-bold mt-4 mb-2">$1</h3>')
        .replace(/^##\s+(.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
        .replace(/^#\s+(.+)$/gm, '<h1 class="text-xl font-bold mt-5 mb-3">$1</h1>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em class="italic opacity-90">$2</em>');

    // 3. Block layout: group consecutive list items into a real <ul>/<ol>.
    const lines = text.split('\n');
    const out: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let paragraph: string[] = [];

    const flushParagraph = () => {
        if (!paragraph.length) return;
        const body = paragraph.join('<br/>');
        // Standalone block-level HTML (code blocks, headings) must not be wrapped in <p>.
        out.push(/^\s*(?: CODE\d+ |<h[1-3])/.test(body)
            ? body
            : `<p class="mb-3 last:mb-0 leading-relaxed">${body}</p>`);
        paragraph = [];
    };
    const closeList = () => {
        if (listType) { out.push(`</${listType}>`); listType = null; }
    };

    for (const line of lines) {
        const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

        if (bullet || numbered) {
            flushParagraph();
            const wanted: 'ul' | 'ol' = bullet ? 'ul' : 'ol';
            if (listType !== wanted) { closeList(); out.push(`<${wanted}>`); listType = wanted; }
            out.push(`<li>${bullet ? bullet[1] : numbered![1]}</li>`);
            continue;
        }

        closeList();
        if (line.trim() === '') flushParagraph();
        else paragraph.push(line);
    }
    closeList();
    flushParagraph();

    let html = out.join('');

    // 4. Restore code blocks.
    codeBlocks.forEach((block, i) => {
        html = html.split(` CODE${i} `).join(block);
    });

    return html;
};

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
    const html = useMemo(() => {
        if (!content) return '';
        // A model that answers with an object or array used to crash the render
        // here ("content.replace is not a function").
        const text = typeof content === 'string'
            ? content
            : Array.isArray(content)
                ? (content as unknown[]).map(String).join('\n')
                : String(content);
        return renderMarkdown(text);
    }, [content]);

    if (!html) return null;

    return (
        <div
            className="markdown-content text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};

export default MarkdownContent;
