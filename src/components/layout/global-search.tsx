"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  Banknote,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Loader2,
  Search,
  School,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchResultType = "Student" | "Teacher" | "Class" | "Subject" | "Fee Challan" | "Test" | "Agenda";

interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const resultIcons: Record<SearchResultType, LucideIcon> = {
  Student: UserRound,
  Teacher: Users,
  Class: School,
  Subject: BookOpen,
  "Fee Challan": Banknote,
  Test: ClipboardCheck,
  Agenda: FileText,
};

const resultColors: Record<SearchResultType, string> = {
  Student: "text-primary",
  Teacher: "text-success",
  Class: "text-text/60",
  Subject: "text-primary",
  "Fee Challan": "text-success",
  Test: "text-text/60",
  Agenda: "text-primary",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if ((event.key === "/" || (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey))) && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Search failed.");
        setResults(payload.data?.results ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Search failed.");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-2 my-2 flex h-9 w-[calc(100%-1rem)] items-center gap-2 border border-border bg-bg px-3 text-left text-sm text-text/60 transition-colors hover:border-text/30 hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label="Open global search"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">Search school data…</span>
        <kbd className="hidden border border-border px-1.5 py-0.5 text-[10px] text-text/40 lg:inline">/</kbd>
      </button>

      {open && (
        <>
          {/* ─── Mobile: full-screen takeover ────────────────────── */}
          <div
            className="fixed inset-0 z-50 flex flex-col bg-bg md:hidden"
            style={{ animation: "global-search-slide-in 200ms ease-out both" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-search-title-mobile"
          >
            {/* Pinned search bar */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <button
                type="button"
                onClick={close}
                className="inline-flex size-8 shrink-0 items-center justify-center border border-transparent text-text/60 transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Close search"
              >
                <ArrowLeft className="size-5" aria-hidden="true" />
              </button>
              <Search className="size-4 shrink-0 text-text/40" aria-hidden="true" />
              <h2 id="global-search-title-mobile" className="sr-only">Search school data</h2>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search students, teachers, classes…"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text/40"
                aria-label="Search school data"
                autoComplete="off"
              />
              {loading && <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-label="Searching" />}
            </div>

            {/* Results fill remaining screen */}
            <div className="flex-1 overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <div className="flex flex-col items-center gap-2 px-3 py-4 text-center text-sm text-text/50">
                  <GraduationCap className="size-5 text-text/30" aria-hidden="true" />
                  <span>Type at least 2 characters to search school data.</span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-danger" role="alert">
                  <X className="size-4 shrink-0" aria-hidden="true" />
                  {error}
                </div>
              ) : !loading && results.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-text/50">
                  <CheckCircle2 className="size-4 shrink-0 text-text/30" aria-hidden="true" />
                  No matching school records.
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((result) => {
                    const Icon = resultIcons[result.type];
                    return (
                      <Link
                        key={`${result.type}-${result.id}`}
                        href={result.href}
                        onClick={close}
                        className="flex items-start gap-3 border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-surface focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        <Icon className={cn("mt-0.5 size-4 shrink-0", resultColors[result.type])} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                            <span className="truncate">{result.title}</span>
                            <span className="border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text/50">{result.type}</span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-text/55">{result.subtitle}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Desktop: centered overlay dialog ────────────────── */}
          <div
            className="hidden md:flex fixed inset-0 z-50 items-start justify-center bg-black/30 px-4 py-16"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <section
              className="w-full max-w-2xl border border-border bg-bg shadow-lg"
              style={{ animation: "dialog-scale-in 200ms ease-out both" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="global-search-title-desktop"
            >
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Search className="size-5 shrink-0 text-text/50" aria-hidden="true" />
                <h2 id="global-search-title-desktop" className="sr-only">Search school data</h2>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search students, teachers, classes, subjects, fees, and tests…"
                  className="h-14 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text/40"
                  aria-label="Search school data"
                  autoComplete="off"
                  ref={inputRef}
                />
                {loading && <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-label="Searching" />}
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex size-8 shrink-0 items-center justify-center border border-transparent text-text/50 transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label="Close search"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">
                {query.trim().length < 2 ? (
                  <div className="flex flex-col items-center gap-2 px-3 py-4 text-center text-sm text-text/50">
                    <GraduationCap className="size-5 text-text/30" aria-hidden="true" />
                    <span>Type at least 2 characters to search school data.</span>
                  </div>
                ) : error ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-sm text-danger" role="alert">
                    <X className="size-4 shrink-0" aria-hidden="true" />
                    {error}
                  </div>
                ) : !loading && results.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-sm text-text/50">
                    <CheckCircle2 className="size-4 shrink-0 text-text/30" aria-hidden="true" />
                    No matching school records.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {results.map((result) => {
                      const Icon = resultIcons[result.type];
                      return (
                        <Link
                          key={`${result.type}-${result.id}`}
                          href={result.href}
                          onClick={close}
                          className="flex items-start gap-3 border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-surface focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                        >
                          <Icon className={cn("mt-0.5 size-4 shrink-0", resultColors[result.type])} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                              <span className="truncate">{result.title}</span>
                              <span className="border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text/50">{result.type}</span>
                            </span>
                            <span className="mt-1 block truncate text-xs text-text/55">{result.subtitle}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}
