/** Category specs and the evaluator (PRD v4, Z6). Import from here. */

export * from '@/lib/intelligence/categories/types'
export { CATEGORY_SPECS, CATEGORY_SPEC_ORDER } from '@/lib/intelligence/categories/registry'
export {
  buildCategoryInsights,
  evaluateCategory,
  specContext,
  NEW_ACTION_IDS,
  type CategoryEvaluation,
  type Finding,
} from '@/lib/intelligence/categories/evaluate'
