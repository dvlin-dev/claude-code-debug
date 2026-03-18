import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function addXmlIndentation(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      result.push('');
      continue;
    }

    // Check if line is an XML tag
    const isClosingTag = /^<\/[\w-]+>$/.test(trimmed);
    const isOpeningTag = /^<[\w-]+>$/.test(trimmed);

    // Decrease depth before closing tag
    if (isClosingTag) {
      depth = Math.max(0, depth - 1);
    }

    // Add indentation using non-breaking spaces to avoid markdown code block interpretation
    const indent = '\u00A0\u00A0'.repeat(depth);
    result.push(indent + trimmed);

    // Increase depth after opening tag
    if (isOpeningTag) {
      depth++;
    }
  }

  return result.join('\n');
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Add XML indentation first, then escape tags
  let processedContent = addXmlIndentation(content);
  processedContent = processedContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const components: Components = {
    // Custom component styles to match theme
    h1: ({ node, ...props }) => <h1 className="text-base font-semibold text-foreground mb-3" {...props} />,
    h2: ({ node, ...props }) => <h2 className="text-sm font-semibold text-foreground mb-2.5" {...props} />,
    h3: ({ node, ...props }) => <h3 className="text-xs font-semibold text-foreground mb-2" {...props} />,
    p: ({ node, ...props }) => <p className="text-xs text-foreground/75 mb-3 break-words whitespace-pre-wrap leading-relaxed" {...props} />,
    code: ({ node, className: codeClassName, children, ...props }) => {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const isInline = !match;
      if (isInline) {
        return <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono break-all" {...props}>{children}</code>;
      }
      return <code className="block bg-muted p-3 rounded overflow-auto text-xs font-mono whitespace-pre-wrap break-all" {...props}>{children}</code>;
    },
    a: ({ node, ...props }) => <a className="text-primary hover:underline break-words" {...props} />,
    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-3 text-xs text-foreground/75 space-y-1 leading-relaxed" {...props} />,
    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-3 text-xs text-foreground/75 space-y-1 leading-relaxed" {...props} />,
    li: ({ node, ...props }) => <li className="text-xs text-foreground/75 leading-relaxed" {...props} />,
    blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-3 text-xs text-foreground/70 italic leading-relaxed" {...props} />,
    strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
    em: ({ node, ...props }) => <em className="italic text-foreground/80" {...props} />,
    hr: ({ node, ...props }) => <hr className="my-4 border-border" {...props} />,
    table: ({ node, ...props }) => <table className="w-full text-xs border-collapse my-3" {...props} />,
    thead: ({ node, ...props }) => <thead className="border-b border-border" {...props} />,
    tbody: ({ node, ...props }) => <tbody {...props} />,
    tr: ({ node, ...props }) => <tr className="border-b border-border/50" {...props} />,
    th: ({ node, ...props }) => <th className="text-left p-2 font-semibold text-foreground" {...props} />,
    td: ({ node, ...props }) => <td className="p-2 text-foreground/75" {...props} />,
  };

  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none break-words', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
