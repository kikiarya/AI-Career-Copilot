import { z } from 'zod';

const EvidenceFieldsSchema = z.object({
  type: z.enum(['project', 'experience', 'skill', 'education', 'achievement', 'other']),
  title: z.string().min(1),
  content: z.string().min(1),
  skills: z.array(z.string()).default([]),
  sourceType: z.enum(['manual', 'resume_paste', 'resume_upload']),
  verificationStatus: z.enum(['draft', 'user_confirmed', 'rejected', 'stale']).default('draft'),
  sourceUrl: z.string().url().nullable().optional(),
  proofLinks: z.array(z.string().url()).default([]),
  metrics: z.array(z.string()).default([]),
  contentHash: z.string().nullable().optional(),
  sourceMetadata: z.record(z.unknown()).default({})
});

export const EvidenceSchema = EvidenceFieldsSchema.extend({
  id: z.string().min(1),
  userId: z.string().uuid().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export const EvidenceCreateSchema = EvidenceFieldsSchema.extend({
  type: EvidenceFieldsSchema.shape.type.default('other'),
  sourceType: EvidenceFieldsSchema.shape.sourceType.default('manual'),
  verificationStatus: z.literal('draft').default('draft')
});

export const EvidencePatchSchema = EvidenceFieldsSchema.partial().omit({
  contentHash: true,
  sourceMetadata: true
});

export const CareerRunInputSchema = z.object({
  jobText: z.string().min(30),
  jobUrl: z.string().url().optional(),
  evidenceIds: z.array(z.string().uuid()).default([]),
  evidence: z.array(EvidenceSchema).default([])
});

export const RunStatusSchema = z.enum([
  'queued',
  'running',
  'awaiting_review',
  'completed',
  'failed',
  'cancelled'
]);

export const CareerRunSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: RunStatusSchema,
  input: CareerRunInputSchema,
  output: z.record(z.unknown()).nullable(),
  error: z.string().nullable(),
  evidenceSnapshot: z.array(EvidenceSchema).default([]),
  attemptCount: z.number().int().nonnegative().default(0),
  leaseUntil: z.string().nullable().optional(),
  heartbeatAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const RunEventSchema = z.object({
  runId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  type: z.enum([
    'run.created', 'run.retried', 'run.recovered', 'run.cancelled',
    'step.started', 'step.completed', 'step.failed', 'run.completed', 'run.failed'
  ]),
  step: z.string().nullable(),
  payload: z.record(z.unknown()),
  createdAt: z.string()
});

export const MatchReportSchema = z.object({
  totalScore: z.number().min(0).max(100),
  requirements: z.array(z.object({
    id: z.string(),
    text: z.string(),
    status: z.enum(['matched', 'partial', 'missing']),
    evidenceRefs: z.array(z.string()),
    reason: z.string(),
    confidence: z.number().min(0).max(1)
  }))
});

export const JobRequirementsSchema = z.object({
  requirements: z.array(z.object({
    id: z.string().min(1),
    key: z.string().min(1),
    text: z.string().min(1),
    category: z.enum(['technical', 'agent', 'retrieval', 'business', 'other']),
    hardGate: z.boolean()
  })).min(1)
});

export const GapDiagnosisListSchema = z.object({
  items: z.array(z.object({
    requirementId: z.string().min(1),
    status: z.enum(['ready', 'weak', 'missing']),
    explanation: z.string().min(1),
    nextAction: z.string().min(1)
  }))
});

export const PreparationPlanListSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(['knowledge_review', 'project_deep_dive', 'coding_practice', 'system_design', 'behavioral_story', 'resume_revision']),
    title: z.string().min(1),
    priority: z.enum(['high', 'medium', 'low'])
  }))
});

export const ArtifactDraftSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  evidenceRefs: z.array(z.string()),
  unsupportedClaims: z.array(z.string())
});

export const CareerOutputSchema = z.object({
  requirements: z.array(z.object({
    id: z.string(),
    text: z.string(),
    category: z.enum(['technical', 'agent', 'retrieval', 'business', 'other']),
    hardGate: z.boolean()
  })),
  matchReport: MatchReportSchema,
  gapDiagnosis: z.array(z.object({
    requirementId: z.string(),
    status: z.enum(['ready', 'weak', 'missing']),
    explanation: z.string(),
    nextAction: z.string()
  })),
  preparationPlan: z.array(z.object({
    id: z.string(),
    type: z.enum(['knowledge_review', 'project_deep_dive', 'coding_practice', 'system_design', 'behavioral_story', 'resume_revision']),
    title: z.string(),
    priority: z.enum(['high', 'medium', 'low'])
  })),
  artifactDraft: z.object({
    title: z.string(),
    content: z.string(),
    evidenceRefs: z.array(z.string()),
    unsupportedClaims: z.array(z.string())
  })
});
