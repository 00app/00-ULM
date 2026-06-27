/**
 * Shared Zod schemas for hot API routes (Phase 0 input validation).
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { FUNNEL_EVENT_NAMES } from '@/lib/analytics/funnelEvents'

const answerValueSchema = z.union([
  z.string().trim().max(2000),
  z.number().finite(),
  z.boolean(),
])

export const answersPostBodySchema = z
  .object({
    journey_id: z.string().trim().max(64).optional(),
    journey_key: z.string().trim().max(64).optional(),
    question_id: z.string().trim().max(120).optional(),
    question_key: z.string().trim().max(120).optional(),
    answer: answerValueSchema.optional(),
    answer_value: answerValueSchema.optional(),
    solo_focus: z.union([z.boolean(), z.number(), z.string().max(16)]).optional(),
    postcode: z.string().trim().max(12).optional(),
    user_id: z.string().uuid().optional(),
  })
  .superRefine((body, ctx) => {
    const jKey = (body.journey_key ?? body.journey_id ?? '').trim()
    const qKey = (body.question_key ?? body.question_id ?? '').trim()
    const value = body.answer_value ?? body.answer
    if (!jKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'journey_key (or journey_id) required' })
    }
    if (!qKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'question_key (or question_id) required' })
    }
    if (value === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'answer (or answer_value) required' })
    }
  })

export type AnswersPostBody = z.infer<typeof answersPostBodySchema>

export const scrapeSyncPostBodySchema = z
  .object({
    trigger: z.union([z.boolean(), z.number(), z.string()]).optional(),
    postcode: z.string().optional(),
    journey_key: z.string().optional(),
    category: z.string().optional(),
    profileData: z.record(z.unknown()).optional(),
    best_offer_hint: z.string().max(1200).optional(),
    user_id: z.string().optional(),
    question_id: z.string().optional(),
    answer_value: z.union([z.string(), z.number()]).optional(),
    force: z.union([z.boolean(), z.number(), z.string()]).optional(),
  })
  .passthrough()

export const analyticsPostBodySchema = z.object({
  event_type: z.string().trim().min(1).max(80),
  session_id: z.string().trim().max(120).optional().nullable(),
  timestamp: z.string().trim().max(48).optional(),
  page: z.string().trim().max(200).optional(),
  referrer: z.string().trim().max(200).optional(),
  props: z.record(z.unknown()).optional(),
})

export const zoneInjectionBirthBodySchema = z
  .object({
    journey_id: z.string().trim().optional(),
    journey_key: z.string().trim().optional(),
    question_id: z.string().trim().optional(),
    question_key: z.string().trim().optional(),
    answer: z.union([z.string(), z.number()]).optional(),
    answer_value: z.union([z.string(), z.number()]).optional(),
    postcode: z.string().nullable().optional(),
    profileData: z
      .object({
        postcode: z.string().nullable().optional(),
        home_type: z.string().nullable().optional(),
        household: z.string().nullable().optional(),
        transport_baseline: z.string().nullable().optional(),
        goal: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    asked_question_ids: z.array(z.string()).optional(),
  })
  .superRefine((body, ctx) => {
    const journey = (body.journey_key ?? body.journey_id ?? '').trim()
    const qKey = (body.question_key ?? body.question_id ?? '').trim()
    const answer = body.answer_value ?? body.answer
    if (!journey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'journey_key required' })
    }
    if (!qKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'question_key required' })
    }
    if (answer === undefined || String(answer).trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'answer_value required' })
    }
  })

export function invalidBodyResponse(error: z.ZodError): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid request body',
      issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    },
    { status: 400 }
  )
}

/** Funnel events must use known names when props are present. */
export function validateFunnelEventType(eventType: string): boolean {
  return FUNNEL_EVENT_NAMES.includes(eventType as (typeof FUNNEL_EVENT_NAMES)[number])
}
