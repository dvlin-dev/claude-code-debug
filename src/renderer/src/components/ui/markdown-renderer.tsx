import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function normalizeXmlContent(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let xmlDepth = 0;
  let inXmlBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect XML tags
    const hasOpenTag = /<[\w-]+>/.test(trimmed);
    const hasCloseTag = /<\/[\w-]+>/.test(trimmed);
    const isStandaloneOpenTag = /^<[\w-]+>$/.test(trimmed);
    const isStandaloneCloseTag = /^<\/[\w-]+>$/.test(trimmed);

    // Track if we're inside an XML block
    if (hasOpenTag || hasCloseTag) {
      inXmlBlock = true;
    }

    // For lines inside XML blocks, normalize indentation
    if (inXmlBlock) {
      // Empty lines
      if (!trimmed) {
        result.push('');
        continue;
      }

      // Standalone closing tag - decrease depth first
      if (isStandaloneCloseTag) {
        xmlDepth = Math.max(0, xmlDepth - 1);
        const indent = '\u00A0\u00A0'.repeat(xmlDepth);
        result.push(indent + trimmed);
        continue;
      }

      // Standalone opening tag
      if (isStandaloneOpenTag) {
        const indent = '\u00A0\u00A0'.repeat(xmlDepth);
        result.push(indent + trimmed);
        xmlDepth++;
        continue;
      }

      // Content inside XML tags - use current depth
      const indent = '\u00A0\u00A0'.repeat(xmlDepth);
      result.push(indent + trimmed);
    } else {
      // Outside XML blocks, preserve original line
      result.push(line);
    }
  }

  return result.join('\n');
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Normalize XML content indentation, then escape tags
  let processedContent = normalizeXmlContent(content);
  processedContent = processedContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const components: Components = {
    // Custom component styles to match theme
    h1: ({ ...props }) => <h1 className="text-base font-semibold text-foreground mb-3" {...props} />,
    h2: ({ ...props }) => <h2 className="text-sm font-semibold text-foreground mb-2.5" {...props} />,
    h3: ({ ...props }) => <h3 className="text-xs font-semibold text-foreground mb-2" {...props} />,
    p: ({ ...props }) => <p className="text-xs text-foreground/75 mb-3 break-words whitespace-pre-wrap leading-relaxed" {...props} />,
    code: ({ className: codeClassName, children, ...props }) => {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const isInline = !match;
      if (isInline) {
        return <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono break-all" {...props}>{children}</code>;
      }
      return <code className="block bg-muted p-3 rounded overflow-auto text-xs font-mono whitespace-pre-wrap break-all" {...props}>{children}</code>;
    },
    a: ({ ...props }) => <a className="text-primary hover:underline break-words" {...props} />,
    ul: ({ ...props }) => <ul className="list-disc list-inside mb-3 text-xs text-foreground/75 space-y-1 leading-relaxed" {...props} />,
    ol: ({ ...props }) => <ol className="list-decimal list-inside mb-3 text-xs text-foreground/75 space-y-1 leading-relaxed" {...props} />,
    li: ({ ...props }) => <li className="text-xs text-foreground/75 leading-relaxed" {...props} />,
    blockquote: ({ ...props }) => <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-3 text-xs text-foreground/70 italic leading-relaxed" {...props} />,
    strong: ({ ...props }) => <strong className="font-semibold text-foreground" {...props} />,
    em: ({ ...props }) => <em className="italic text-foreground/80" {...props} />,
    hr: ({ ...props }) => <hr className="my-4 border-border" {...props} />,
    table: ({ ...props }) => <table className="w-full text-xs border-collapse my-3" {...props} />,
    thead: ({ ...props }) => <thead className="border-b border-border" {...props} />,
    tbody: ({ ...props }) => <tbody {...props} />,
    tr: ({ ...props }) => <tr className="border-b border-border/50" {...props} />,
    th: ({ ...props }) => <th className="text-left p-2 font-semibold text-foreground" {...props} />,
    td: ({ ...props }) => <td className="p-2 text-foreground/75" {...props} />,
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
