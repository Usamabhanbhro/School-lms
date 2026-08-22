"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Shared student data shape used across all pickers.
 * Includes Student ID (school-wide unique) and Roll Number.
 */
export interface StudentPickerStudent {
  id: string;
  name: string;
  guardianName: string;
  studentId: string | null;
  classSection: { id: string; className: string; sectionName: string };
}

interface StudentPickerProps {
  /** All students available for selection */
  students: StudentPickerStudent[];
  /** Currently selected student ID (empty string = none) */
  selectedStudentId: string;
  /** Callback when a student is selected or cleared */
  onSelect: (studentId: string) => void;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Optional class section ID to scope results (class-scoped dropdown mode) */
  classSectionId?: string;
  /** Label shown for the currently selected student */
  selectedLabel?: string;
}

/**
 * Format student display as "ID — Name" or just "Name" if no ID.
 */
function formatStudentDisplay(student: StudentPickerStudent): string {
  return student.studentId
    ? `${student.studentId} — ${student.name}`
    : student.name;
}

/**
 * Shared student picker component.
 *
 * Two interaction modes:
 * 1. Free-text search (default) — searches across all students by name, guardian, or student ID
 * 2. Class-scoped dropdown — pass `classSectionId` to show a dropdown filtered to one class
 *
 * Both modes display Student ID alongside name.
 */
export function StudentPicker({
  students,
  selectedStudentId,
  onSelect,
  searchPlaceholder = "Search by name, guardian, or student ID…",
  disabled = false,
  classSectionId,
}: StudentPickerProps) {
  const [search, setSearch] = useState("");

  // Filter students for free-text search mode
  const filteredStudents = useMemo(() => {
    if (classSectionId) return students;
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.guardianName.toLowerCase().includes(q) ||
        (s.studentId && s.studentId.toLowerCase().includes(q)),
    );
  }, [students, search, classSectionId]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Class-scoped dropdown mode
  if (classSectionId) {
    const classStudents = students.filter(
      (s) => s.classSection.id === classSectionId,
    );
    return (
      <select
        value={selectedStudentId}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled || classStudents.length === 0}
        className="h-10 w-full border border-border bg-bg px-4 text-sm text-text disabled:opacity-50"
      >
        <option value="">Select student…</option>
        {classStudents.map((s) => (
          <option key={s.id} value={s.id}>
            {formatStudentDisplay(s)}
          </option>
        ))}
      </select>
    );
  }

  // Free-text search mode
  return (
    <div>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text/40"
          aria-hidden="true"
        />
        <Input
          placeholder={searchPlaceholder}
          value={selectedStudentId ? formatStudentDisplay(selectedStudent!) : search}
          onChange={(e) => {
            setSearch(e.target.value);
            onSelect("");
          }}
          disabled={disabled}
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
                onSelect(s.id);
                setSearch("");
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface"
            >
              <span className="font-medium">
                {s.studentId && (
                  <span className="mr-1.5 text-xs tabular-nums text-text/50">
                    {s.studentId}
                  </span>
                )}
                {s.name}
              </span>
              <span className="text-xs text-text/50">
                {s.classSection.className} — {s.classSection.sectionName}
              </span>
            </button>
          ))}
        </div>
      )}
      {selectedStudent && (
        <p className="mt-1 text-xs text-text/50">
          {formatStudentDisplay(selectedStudent)} — Guardian:{" "}
          {selectedStudent.guardianName}
        </p>
      )}
    </div>
  );
}
