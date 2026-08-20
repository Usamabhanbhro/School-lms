-- Migration: Add ACADEMICS to Role enum
-- Postgres limitation: a newly added enum value cannot be referenced in the
-- same transaction that added it. This migration adds the value only; the next
-- migration may reference it freely.

ALTER TYPE "Role" ADD VALUE 'ACADEMICS';
