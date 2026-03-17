import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const components: Components = {
    // Custom component styles to match theme
    h1: ({ node, ...props }) => <h1 className="text-lg font-semibold text-foreground mb-2" {...props} />,
    h2: ({ node, ...props }) => <h2 className="text-base font-semibold text-foreground mb-2" {...props} />,
    h3: ({ node, ...props }) => <h3 className="text-sm font-semibold text-foreground mb-1" {...props} />,
    p: ({ node, ...props }) => <p className="text-sm text-foreground/90 mb-2 break-words whitespace-pre-wrap" {...props} />,
    code: ({ node, className: codeClassName, children, ...props }) => {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const isInline = !match;
      if (isInline) {
        return <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono break-all" {...props}>{children}</code>;
      }
      return <code className="block bg-muted p-3 rounded overflow-auto text-xs font-mono whitespace-pre-wrap break-all" {...props}>{children}</code>;
    },
    a: ({ node, ...props }) => <a className="text-primary hover:underline break-words" {...props} />,
    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 text-sm" {...props} />,
    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 text-sm" {...props} />,
  };

  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
