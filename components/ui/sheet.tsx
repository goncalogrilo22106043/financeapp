"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

export function Sheet({ open, title, children, onClose }: SheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Fechar"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <section
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[2rem] border border-border bg-background p-5 shadow-soft",
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[2rem]"
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Button aria-label="Fechar" size="icon" type="button" variant="secondary" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}
