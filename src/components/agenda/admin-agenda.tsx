"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileText,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, getApiErrorMessage } from "@/lib/utils";
import { getTodayLocal } from "@/lib/timezone";

// ─── Types ──────────────────────────────────────────────────────────

interface Teacher {
  id: string;
  name: string;
}

interface ClassSection {
  id: string;
  className: string;
  sectionName: string;
}

interface Subject {
  id: string;
  name: string;
}

interface AgendaEntry {
  id: string;
  content: string;
  date: string;
  isLocked: boolean;
  teacher: Teacher;
  classSection: ClassSection;
  subject: Subject;
  createdAt: string;
  updatedAt: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function AdminAgenda() {
  const [entries, setEntries] = useState<AgendaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [teacherFilter, setTeacherFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const today = getTodayLocal();

  // Dropdown data
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const [dropdownError, setDropdownError] = useState<string | null>(null);

  // Expanded entry for content preview
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ─── Load dropdown data ──────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        setDropdownError(null);
        const [teachersRes, classesRes, subjectsRes] = await Promise.all([
          fetch("/api/teachers"),
          fetch("/api/class-sections"),
          fetch("/api/subjects"),
        ]);

        const [teachersJson, classesJson, subjectsJson] = await Promise.all([
          teachersRes.json(),
          classesRes.json(),
          subjectsRes.json(),
        ]);
        if (!teachersRes.ok) throw new Error(getApiErrorMessage(teachersJson, "Unable to load teachers for the agenda filters."));
        if (!classesRes.ok) throw new Error(getApiErrorMessage(classesJson, "Unable to load classes for the agenda filters."));
        if (!subjectsRes.ok) throw new Error(getApiErrorMessage(subjectsJson, "Unable to load subjects for the agenda filters."));
        setTeachers(teachersJson.data ?? []);
        setClassSections(classesJson.data ?? []);
        setSubjects(subjectsJson.data ?? []);
      } catch (error) {
        setDropdownError(error instanceof Error ? error.message : "Unable to load agenda filters right now.");
      } finally {
        setLoadingDropdowns(false);
      }
    })();
  }, []);

  // ─── Load entries ────────────────────────────────────────────

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (teacherFilter) params.set("teacherId", teacherFilter);
      if (classFilter) params.set("classSectionId", classFilter);
      if (subjectFilter) params.set("subjectId", subjectFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const res = await fetch(`/api/agenda?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(json, "Unable to load agenda entries right now."));
      setEntries(json.data ?? []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load agenda entries right now.");
    } finally {
      setLoading(false);
    }
  }, [teacherFilter, classFilter, subjectFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Daily Agenda"
        description="Read-only view of teacher agenda entries across all classes and subjects."
      />

      {/* Filters */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px]">
            <label
              htmlFor="admin-agenda-teacher"
              className="mb-1 block text-xs font-medium text-text/60"
            >
              Teacher
            </label>
            {loadingDropdowns ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                id="admin-agenda-teacher"
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="h-10 w-full border border-border bg-bg px-4 text-sm text-text"
              >
                <option value="">All teachers</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="min-w-[180px]">
            <label
              htmlFor="admin-agenda-class"
              className="mb-1 block text-xs font-medium text-text/60"
            >
              Class Section
            </label>
            {loadingDropdowns ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                id="admin-agenda-class"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="h-10 w-full border border-border bg-bg px-4 text-sm text-text"
              >
                <option value="">All classes</option>
                {classSections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.className} — {c.sectionName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="min-w-[150px]">
            <label
              htmlFor="admin-agenda-subject"
              className="mb-1 block text-xs font-medium text-text/60"
            >
              Subject
            </label>
            {loadingDropdowns ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                id="admin-agenda-subject"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="h-10 w-full border border-border bg-bg px-4 text-sm text-text"
              >
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label
              htmlFor="admin-agenda-from"
              className="mb-1 block text-xs font-medium text-text/60"
            >
              From
            </label>
            <input
              id="admin-agenda-from"
              type="date"
              value={dateFrom}
              max={dateTo || today}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 border border-border bg-bg px-4 text-sm text-text"
            />
          </div>

          <div>
            <label
              htmlFor="admin-agenda-to"
              className="mb-1 block text-xs font-medium text-text/60"
            >
              To
            </label>
            <input
              id="admin-agenda-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              max={today}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 border border-border bg-bg px-4 text-sm text-text"
            />
          </div>
        </div>
      </Card>

      {/* Filter-data error */}
      {dropdownError && (
        <div className="mb-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {dropdownError}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="mb-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {error}
          <Button
            variant="ghost"
            onClick={loadEntries}
            className="ml-auto h-8 px-2 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No agenda entries"
          description="No daily agenda entries match your filters."
        />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <Card key={entry.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : entry.id)
                  }
                  className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface"
                  aria-expanded={isExpanded}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {entry.classSection.className} —{" "}
                        {entry.classSection.sectionName}
                      </span>
                      <span className="text-xs text-text/40">·</span>
                      <span className="text-sm text-text/60">
                        {entry.subject.name}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-text/50">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" aria-hidden="true" />
                        {entry.date}
                      </span>
                      <span>·</span>
                      <span>By {entry.teacher.name}</span>
                      <span>·</span>
                      {entry.isLocked ? (
                        <span className="inline-flex items-center gap-0.5 text-success">
                          <Lock className="size-3" aria-hidden="true" />
                          Locked
                        </span>
                      ) : (
                        <span className="text-primary">Editable</span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="size-4 shrink-0 text-text/40" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-text/40" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm text-text/80">
                      {entry.content}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-text/40">
                      <span>
                        Created:{" "}
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                      <span>
                        Updated:{" "}
                        {new Date(entry.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
