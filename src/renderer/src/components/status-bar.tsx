import { useState } from "react";
import { Settings, Copy, Check } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useAppStore } from "../stores/app-store";
import { ListeningToggle } from "./listening-toggle";

interface StatusBarProps {
  onSettingsClick: () => void;
}

export function StatusBar({ onSettingsClick }: StatusBarProps) {
  const { isListening, proxyAddress } = useAppStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!proxyAddress) return;
    navigator.clipboard.writeText(proxyAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-12 items-center justify-between border-b px-4 drag-region">
      <span className="font-medium text-sm pl-16">Agent Trace</span>

      <div className="flex items-center gap-3">
        {isListening && proxyAddress && (
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="font-mono text-xs">
              {proxyAddress}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
              title="Copy proxy address"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
        <ListeningToggle />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onSettingsClick}
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Badge variant="outline" className="text-xs text-muted-foreground">
          ⌘K
        </Badge>
      </div>
    </div>
  );
}
