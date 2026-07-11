import { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
  onNew?: () => void;
  newLabel?: string;
  children: ReactNode;
}

export function PageShell({ title, description, actions, onNew, newLabel = "Novo", children }: Props) {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {actions}
          {onNew && (
            <Button onClick={onNew} size="sm" className="shadow-elegant sm:size-default">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{newLabel}</span>
            </Button>
          )}
        </div>
      </div>
      <Card className="shadow-card overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">{children}</CardContent>
      </Card>
    </div>
  );
}
