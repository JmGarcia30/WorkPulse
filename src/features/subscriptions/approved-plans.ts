import type { SubscriptionTier } from '@prisma/client';

// Approved commercial definitions. Existing catalog rows may still contain the
// pre-approval draft flags; applying these rules requires no schema/data rewrite.
export const approvedPlans = {
  BASIC: {
    description: 'Core HR, manual recruitment, five active job postings, basic analytics, standard reports and branding, Gmail integration, attendance, payroll, leave, ESS and exit management.',
    aiResumeParsing: false, advancedAnalytics: false, gmailIntegration: true, customBranding: false,
    maxEmployees: null, maxActiveJobs: 5,
  },
  PRO: {
    description: 'Everything in Basic, unlimited active job postings, full analytics, AI resume parsing, existing advanced analytics reports and exports, and custom organization branding.',
    aiResumeParsing: true, advancedAnalytics: true, gmailIntegration: true, customBranding: true,
    maxEmployees: null, maxActiveJobs: null,
  },
} as const;

export function approvedPlan<T extends { tier: SubscriptionTier }>(plan: T) {
  return { ...plan, ...approvedPlans[plan.tier] };
}

export function approvedPlanConfiguration(tier: SubscriptionTier) {
  const { maxActiveJobs: _jobLimit, ...configuration } = approvedPlans[tier];
  void _jobLimit;
  return configuration;
}
