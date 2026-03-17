import { Badge } from './badge';
import { cn } from '@/lib/utils';

interface SchemaFieldRendererProps {
  schema: unknown;
  depth?: number;
  maxDepth?: number;
}

export function SchemaFieldRenderer({
  schema,
  depth = 0,
  maxDepth = 3
}: SchemaFieldRendererProps) {
  if (depth > maxDepth) {
    return <Badge variant="outline" className="text-[10px]">Complex nested schema</Badge>;
  }

  if (!schema || typeof schema !== 'object') {
    return <span className="text-xs text-muted-foreground">Invalid schema</span>;
  }

  const s = schema as Record<string, any>;
  const { type, description, properties, required = [], enum: enumValues, items } = s;

  return (
    <div className="space-y-2">
      {/* Type badge */}
      {type && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Type:</span>
          <Badge variant="outline" className="text-[10px]">{type}</Badge>
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-foreground/80">{description}</p>
      )}

      {/* Enum values */}
      {enumValues && Array.isArray(enumValues) && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground">Values:</span>
          {enumValues.map((val: any, i: number) => (
            <Badge key={i} variant="secondary" className="text-[10px]">
              {String(val)}
            </Badge>
          ))}
        </div>
      )}

      {/* Object properties */}
      {properties && typeof properties === 'object' && (
        <div className="space-y-2 pl-3 border-l-2 border-border">
          <span className="text-xs font-medium text-muted-foreground">Properties:</span>
          {Object.entries(properties).map(([key, propSchema]) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-medium">
                  {key}
                  {required.includes(key) && <span className="text-destructive">*</span>}
                </span>
              </div>
              <div className="pl-3">
                <SchemaFieldRenderer
                  schema={propSchema}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Array items */}
      {items && (
        <div className="space-y-1 pl-3 border-l-2 border-border">
          <span className="text-xs font-medium text-muted-foreground">Items:</span>
          <SchemaFieldRenderer
            schema={items}
            depth={depth + 1}
            maxDepth={maxDepth}
          />
        </div>
      )}
    </div>
  );
}
