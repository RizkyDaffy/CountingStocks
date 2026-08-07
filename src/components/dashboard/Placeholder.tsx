import { Construction } from "lucide-react";

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="animate-in fade-in duration-300">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <div className="mt-6 flex min-h-[60vh] items-center justify-center rounded-3xl border border-border bg-card p-10">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-card-elevated text-muted-foreground">
            <Construction className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-lg font-medium text-foreground">
            This page hasn't been created
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Content for "{title}" is on its way. Sit tight while we build this experience.
          </p>
        </div>
      </div>
    </div>
  );
}
