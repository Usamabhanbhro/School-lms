"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Award,
  FileText,
  Printer,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  guardianName: string;
  classSection: { id: string; className: string; sectionName: string };
}

interface Certificate {
  id: string;
  type: "LEAVING" | "CHARACTER";
  student: {
    id: string;
    name: string;
    classSection: { className: string; sectionName: string };
  };
  generatedByUser: { id: string; name: string };
  issuedDate: string;
  createdAt: string;
}

// ─── Component ──────────────────────────────────────────────────

export function CertificateGeneration() {
  const { addToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [certType, setCertType] = useState<"LEAVING" | "CHARACTER">("LEAVING");
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsRes, certsRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/certificates"),
      ]);

      if (!studentsRes.ok) throw new Error("Failed to load students");
      if (!certsRes.ok) throw new Error("Failed to load certificates");

      const [studentsJson, certsJson] = await Promise.all([
        studentsRes.json(),
        certsRes.json(),
      ]);

      setStudents(studentsJson.data ?? []);
      setCertificates(certsJson.data ?? []);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.guardianName.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  async function handleGenerate() {
    if (!selectedStudentId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudentId, type: certType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to generate certificate");

      addToast("success", "Certificate generated successfully");
      setSelectedStudentId("");
      setSearch("");
      fetchData();

      // Open print view
      window.open(`/print/certificates/${json.data.id}`, "_blank");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Error loading data"
        description={error}
        action={<Button variant="secondary" onClick={fetchData}>Retry</Button>}
      />
    );
  }

  return (
    <>
      {/* Generate form */}
      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-base font-semibold">Generate Certificate</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Student search */}
          <div>
            <label htmlFor="student-search" className="mb-1 block text-xs font-medium text-text/60">
              Student
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text/40" aria-hidden="true" />
              <Input
                id="student-search"
                placeholder="Search by student or guardian name…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedStudentId("");
                }}
                className="pl-9"
              />
            </div>
            {search && !selectedStudentId && filteredStudents.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto border border-border bg-bg">
                {filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudentId(s.id);
                      setSearch(`${s.name} (${s.classSection.className} ${s.classSection.sectionName})`);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-text/50">
                      {s.classSection.className} — {s.classSection.sectionName}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedStudent && (
              <p className="mt-1 text-xs text-text/50">
                {selectedStudent.name} — Guardian: {selectedStudent.guardianName}
              </p>
            )}
          </div>

          {/* Certificate type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text/60">
              Certificate Type
            </label>
            <div className="flex gap-2">
              {(["LEAVING", "CHARACTER"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCertType(t)}
                  className={cn(
                    "flex-1 border px-4 py-2.5 text-sm font-medium transition-colors",
                    certType === t
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-bg text-text/70 hover:bg-surface",
                  )}
                >
                  {t === "LEAVING" ? "Leaving Certificate" : "Character Certificate"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button
            onClick={handleGenerate}
            disabled={!selectedStudentId || generating}
          >
            {generating ? "Generating…" : "Generate & Print"}
          </Button>
          {selectedStudentId && (
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedStudentId("");
                setSearch("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* History */}
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text/60">
        Generated Certificates
      </h3>
      {certificates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No certificates generated yet"
          description="Generated certificates will appear here for reprinting."
        />
      ) : (
        <div className="space-y-2">
          {certificates.map((cert) => (
            <Card key={cert.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{cert.student.name}</span>
                  <span className="text-xs text-text/40">•</span>
                  <span className="text-sm text-text/60">
                    {cert.student.classSection.className} — {cert.student.classSection.sectionName}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-text/50">
                  {cert.type === "LEAVING" ? "Leaving" : "Character"} Certificate ·{" "}
                  {new Date(cert.issuedDate).toLocaleDateString()} ·{" "}
                  Generated by {cert.generatedByUser.name}
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => window.open(`/print/certificates/${cert.id}`, "_blank")}
                title="Print certificate"
              >
                <Printer className="size-3.5" aria-hidden="true" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
