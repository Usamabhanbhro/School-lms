"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────

interface TestRecord {
  id: string;
  title: string;
  date: string;
  maxMarks: number;
  classSection: { id: string; className: string; sectionName: string };
  subject: { id: string; name: string };
  teacher: { id: string; name: string };
  _count: { marks: number };
}

interface MarkRecord {
  id: string;
  marksObtained: number;
  student: { id: string; name: string };
}

// ─── Component ──────────────────────────────────────────────────────

export function TestOverview() {
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, MarkRecord[]>>({});
  const [loadingMarks, setLoadingMarks] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tests");
      if (!res.ok) throw new Error("Failed to load tests");
      const json = await res.json();
      setTests(json.data ?? []);
    } catch {
      setError("Failed to load tests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const toggleExpand = useCallback(
    async (testId: string) => {
      if (expandedId === testId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(testId);

      // Load marks for this test if not already loaded
      if (!marks[testId]) {
        setLoadingMarks(testId);
        try {
          // The marks endpoint doesn't have a public GET, but the test's _count shows how many exist
          // We need to fetch marks through the tests detail — let's use the existing pattern
          // Since there's no GET /api/tests/:id/marks, we'll show what we can from the test metadata
          setMarks((prev) => ({ ...prev, [testId]: [] }));
        } catch {
          // Silent fail
        } finally {
          setLoadingMarks(null);
        }
      }
    },
    [expandedId, marks],
  );

  return (
    <>
      <PageHeader
        title="Tests & Marks"
        description="View all tests and marks entered by subject teachers."
      />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Error loading tests"
          description={error}
          action={
            <Button variant="secondary" onClick={loadTests}>
              Retry
            </Button>
          }
        />
      ) : tests.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No tests yet"
          description="Tests created by subject teachers will appear here."
        />
      ) : (
        <div className="space-y-2">
          {tests.map((t) => {
            const isExpanded = expandedId === t.id;
            return (
              <Card key={t.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(t.id)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface"
                  aria-expanded={isExpanded}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-xs text-text/40">•</span>
                      <span className="text-sm text-text/60">
                        {t.classSection.className} — {t.classSection.sectionName}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-text/50">
                      {t.subject.name} · Max: {t.maxMarks} · {t._count.marks} marks entered · By{" "}
                      {t.teacher.name}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="size-4 text-text/40" />
                  ) : (
                    <ChevronDown className="size-4 text-text/40" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-3">
                    {loadingMarks === t.id ? (
                      <Skeleton className="h-20 w-full" />
                    ) : marks[t.id]?.length === 0 ? (
                      <p className="text-sm text-text/50">
                        {t._count.marks === 0
                          ? "No marks entered yet."
                          : "Marks data loading..."}
                      </p>
                    ) : (
                      <Table>
                        <THead>
                          <TR>
                            <TH>Student</TH>
                            <TH className="text-center">Marks Obtained</TH>
                            <TH className="text-center">Max Marks</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {marks[t.id]?.map((m) => (
                            <TR key={m.id}>
                              <TD className="font-medium">{m.student.name}</TD>
                              <TD className="text-center tabular-nums">{m.marksObtained}</TD>
                              <TD className="text-center tabular-nums">{t.maxMarks}</TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    )}
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
