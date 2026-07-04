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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {onNew && (
            <Button onClick={onNew} className="shadow-elegant">
              <Plus className="h-4 w-4 mr-2" /> {newLabel}
            </Button>
          )}
        </div>
      </div>
      <Card className="shadow-card">
        <CardContent className="p-0">{children}</CardContent>
      </Card>
    </div>
  );
}
