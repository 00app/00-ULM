/**
 * Profile employment segmentation — student / employed / between jobs.
 * Legacy SELF_EMPLOYED → EMPLOYED; UNEMPLOYED → BETWEEN_JOBS at normalize time.
 */

import type { EmploymentStatus } from '@/lib/brains/types'

function compactEmploymentToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

export function normalizeEmploymentStatus(
  raw: string | undefined | null
): EmploymentStatus | undefined {
  const u = compactEmploymentToken(String(raw ?? ''))
  if (!u) return undefined

  if (u === 'STUDENT' || u === 'STUDYING' || u === 'IN_EDUCATION' || u === 'SCHOOL' || u === 'UNI') {
    return 'STUDENT'
  }
  if (
    u === 'EMPLOYED' ||
    u === 'SELF_EMPLOYED' ||
    u === 'EMPLOYED_FULL_TIME' ||
    u === 'EMPLOYED_PART_TIME' ||
    u === 'FULL_TIME' ||
    u === 'PART_TIME' ||
    u === 'WORKING'
  ) {
    return 'EMPLOYED'
  }
  if (
    u === 'BETWEEN_JOBS' ||
    u === 'UNEMPLOYED' ||
    u === 'NOT_WORK' ||
    u === 'NOT_IN_WORK' ||
    u === 'SEEKING_WORK' ||
    u === 'JOBSEEKER'
  ) {
    return 'BETWEEN_JOBS'
  }
  return undefined
}

export function isActiveEmployed(raw?: string | null): boolean {
  return normalizeEmploymentStatus(raw) === 'EMPLOYED'
}

export function isStudent(raw?: string | null): boolean {
  return normalizeEmploymentStatus(raw) === 'STUDENT'
}

export function isBetweenJobs(raw?: string | null): boolean {
  return normalizeEmploymentStatus(raw) === 'BETWEEN_JOBS'
}

/** Bill-survival lane — grants and low-barrier wins stay visible. */
export function isBillSurvivalSegment(raw?: string | null): boolean {
  const s = normalizeEmploymentStatus(raw)
  return s === 'STUDENT' || s === 'BETWEEN_JOBS'
}

export function employmentSegmentLabel(status?: EmploymentStatus | null): string {
  switch (status) {
    case 'STUDENT':
      return 'student'
    case 'EMPLOYED':
      return 'employed'
    case 'BETWEEN_JOBS':
      return 'between jobs'
    default:
      return 'unknown'
  }
}
