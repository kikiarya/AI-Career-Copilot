import {
  ArtifactDraftSchema,
  CareerOutputSchema,
  GapDiagnosisListSchema,
  JobRequirementsSchema,
  PreparationPlanListSchema
} from '@copilot/contracts';
import { createModelGateway, ModelGatewayError } from '@copilot/model-gateway';

const requirementCatalog = [
  { key: 'langgraph', terms: ['langgraph'], text: 'LangGraph 或可恢复的 Agent 工作流经验', category: 'agent' },
  { key: 'rag', terms: ['rag', 'retrieval', '检索'], text: 'RAG、Embedding 或检索系统经验', category: 'retrieval' },
  { key: 'tool calling', terms: ['tool calling', 'function calling', '工具调用'], text: 'Tool Calling、工具权限或结构化工具协议经验', category: 'agent' },
  { key: 'python', terms: ['python'], text: 'Python 开发经验', category: 'technical' },
  { key: 'javascript', terms: ['javascript', 'node.js', 'nodejs'], text: 'JavaScript/Node.js 开发经验', category: 'technical' },
  { key: 'evaluation', terms: ['evaluation', 'eval', '评测'], text: '模型或 Agent 评测经验', category: 'agent' },
  { key: 'docker', terms: ['docker', 'container'], text: 'Docker 或容器化部署经验', category: 'technical' }
];

function containsTerm(text, terms) {
  return terms.some((term) => text.includes(term));
}

function detectRequirements(jobText) {
  const lower = jobText.toLowerCase();
  const detected = requirementCatalog.filter((item) => containsTerm(lower, item.terms));
  return detected.length > 0
    ? detected.map((item, index) => ({ ...item, id: `req_${index + 1}`, hardGate: false }))
    : [
        { id: 'req_1', key: 'agent', terms: ['agent', 'llm'], text: 'AI Agent 应用开发经验', category: 'agent', hardGate: false },
        { id: 'req_2', key: 'explainable', terms: ['agent', 'llm', 'test'], text: '能够构建可解释、可测试的 LLM 应用', category: 'technical', hardGate: false }
      ];
}

function evidenceText(evidence) {
  return `${evidence.title} ${evidence.content} ${(evidence.skills ?? []).join(' ')}`.toLowerCase();
}

function termsForRequirement(requirement) {
  const lowerText = `${requirement.key} ${requirement.text}`.toLowerCase();
  const catalogTerms = requirementCatalog
    .filter((item) => lowerText.includes(item.key) || item.terms.some((term) => lowerText.includes(term)))
    .flatMap((item) => item.terms);
  return [...new Set([requirement.key, ...catalogTerms].filter(Boolean))];
}

function matchRequirements(requirements, evidence) {
  return requirements.map((requirement) => {
    const matches = evidence.filter((item) => containsTerm(evidenceText(item), requirement.terms));
    const confirmed = matches.filter((item) => item.verificationStatus === 'user_confirmed');
    const status = confirmed.length > 0 ? 'matched' : matches.length > 0 ? 'partial' : 'missing';
    return {
      id: requirement.id,
      text: requirement.text,
      status,
      evidenceRefs: matches.map((item) => item.id),
      reason: status === 'matched'
        ? `Matched ${confirmed.length} user-confirmed evidence item(s).`
        : status === 'partial'
          ? 'Potential evidence exists, but it has not been confirmed by the user.'
          : 'No candidate evidence was found for this requirement.',
      confidence: status === 'matched' ? 0.82 : status === 'partial' ? 0.58 : 0.25
    };
  });
}

function buildGapDiagnosis(matchReport) {
  return matchReport.requirements.map((item) => ({
    requirementId: item.id,
    status: item.status === 'matched' ? 'ready' : item.status === 'partial' ? 'weak' : 'missing',
    explanation: item.reason,
    nextAction: item.status === 'matched'
      ? 'Prepare a project deep-dive answer with measurable evidence.'
      : item.status === 'partial'
        ? 'Review and confirm the potential Evidence, then add implementation depth or metrics.'
        : 'Add or verify a relevant experience before making a claim.'
  }));
}

function buildPreparationPlan(matchReport) {
  return matchReport.requirements.map((item, index) => ({
    id: `prep_${index + 1}`,
    type: item.status === 'matched' ? 'project_deep_dive' : 'knowledge_review',
    title: item.status === 'matched' ? `Prepare deep-dive: ${item.text}` : `Close gap: ${item.text}`,
    priority: item.status === 'matched' ? 'medium' : 'high'
  }));
}

function buildArtifactDraft(evidence) {
  const usableEvidence = evidence.filter((item) => item.verificationStatus === 'user_confirmed');
  const artifactLines = usableEvidence.length > 0
    ? usableEvidence.map((item) => `- [${item.id}] ${item.title}: ${item.content}`).join('\n')
    : '- No user-confirmed evidence is available yet; review Evidence before using this draft.';
  return {
    title: 'Evidence-grounded application summary',
    content: `This draft only uses user-confirmed evidence.\n\n${artifactLines}`,
    evidenceRefs: usableEvidence.map((item) => item.id),
    unsupportedClaims: usableEvidence.length > 0 ? [] : ['No user-confirmed evidence available.']
  };
}

export function buildOutput(input, evidence = input.evidence ?? []) {
  const requirements = detectRequirements(input.jobText);
  const requirementsWithMatches = matchRequirements(requirements, evidence);
  const matchedCount = requirementsWithMatches.filter((item) => item.status === 'matched').length;
  return CareerOutputSchema.parse({
    requirements: requirements.map(({ id, text, category, hardGate }) => ({ id, text, category, hardGate })),
    matchReport: {
      totalScore: Math.round((matchedCount / Math.max(requirements.length, 1)) * 100),
      requirements: requirementsWithMatches
    },
    gapDiagnosis: buildGapDiagnosis({ requirements: requirementsWithMatches }),
    preparationPlan: buildPreparationPlan({ requirements: requirementsWithMatches }),
    artifactDraft: buildArtifactDraft(evidence)
  });
}

export async function runCareerWorkflow({ run, repository, gateway: configuredGateway }) {
  const evidence = run.evidenceSnapshot ?? run.input.evidence ?? [];
  const gateway = configuredGateway ?? createModelGateway({ MODEL_PROVIDER: 'mock' });
  const providerInfo = gateway.describe();
  const state = { requirements: null, matchReport: null, gapDiagnosis: null, preparationPlan: null, artifactDraft: null };
  const steps = [
    ['analyze_requirements', 'Extract job requirements from the supplied JD.'],
    ['match_candidate_evidence', 'Match requirements only to the run Evidence snapshot.'],
    ['diagnose_gaps', 'Separate missing evidence from unconfirmed or weak evidence.'],
    ['create_preparation_plan', 'Create targeted preparation tasks.'],
    ['create_artifact_draft', 'Create an editable, evidence-grounded draft.']
  ];

  for (const [step, description] of steps) {
    await repository.appendEvent({
      runId: run.id,
      type: 'step.started',
      step,
      payload: { description, ...providerInfo, traceVersion: '0.3' }
    });
    try {
      if (step === 'analyze_requirements') {
        const fallback = {
          requirements: detectRequirements(run.input.jobText).map(({ id, key, text, category, hardGate }) => ({ id, key, text, category, hardGate }))
        };
        const generated = await gateway.generateStructured({
          task: 'analyze_requirements',
          systemPrompt: 'Extract explicit technical, agent, retrieval, business, and hard-gate requirements from the job description. Do not invent requirements.',
          userPrompt: run.input.jobText,
          schema: JobRequirementsSchema,
          fallbackValue: fallback
        });
        state.requirements = generated.value.requirements.map((item) => ({ ...item, terms: termsForRequirement(item) }));
      }
      if (step === 'match_candidate_evidence') {
        state.matchReport = {
          totalScore: 0,
          requirements: matchRequirements(state.requirements, evidence)
        };
        const matchedCount = state.matchReport.requirements.filter((item) => item.status === 'matched').length;
        state.matchReport.totalScore = Math.round((matchedCount / Math.max(state.requirements.length, 1)) * 100);
      }
      if (step === 'diagnose_gaps') {
        const fallback = { items: buildGapDiagnosis(state.matchReport) };
        const generated = await gateway.generateStructured({
          task: 'diagnose_gaps',
          systemPrompt: 'Diagnose readiness strictly from the supplied requirement match report. Distinguish missing evidence from weak evidence.',
          userPrompt: JSON.stringify(state.matchReport),
          schema: GapDiagnosisListSchema,
          fallbackValue: fallback
        });
        const requirementIds = new Set(state.matchReport.requirements.map((item) => item.id));
        if (generated.value.items.length !== requirementIds.size || generated.value.items.some((item) => !requirementIds.has(item.requirementId))) {
          throw new ModelGatewayError('Gap diagnosis did not cover every requirement.', { code: 'workflow_coverage_error', retryable: false });
        }
        state.gapDiagnosis = generated.value.items;
      }
      if (step === 'create_preparation_plan') {
        const fallback = { items: buildPreparationPlan(state.matchReport) };
        const generated = await gateway.generateStructured({
          task: 'create_preparation_plan',
          systemPrompt: 'Create a focused preparation plan from the supplied gap diagnosis. Return one actionable task for every requirement.',
          userPrompt: JSON.stringify(state.gapDiagnosis),
          schema: PreparationPlanListSchema,
          fallbackValue: fallback
        });
        state.preparationPlan = generated.value.items;
      }
      if (step === 'create_artifact_draft') {
        const confirmedIds = new Set(evidence.filter((item) => item.verificationStatus === 'user_confirmed').map((item) => item.id));
        const fallback = buildArtifactDraft(evidence);
        const generated = await gateway.generateStructured({
          task: 'create_artifact_draft',
          systemPrompt: 'Write an editable application summary using only user-confirmed Evidence. Never invent numbers, roles, companies, or responsibilities. If evidence is insufficient, state that clearly.',
          userPrompt: JSON.stringify({ requirements: state.requirements, evidence: evidence.filter((item) => confirmedIds.has(item.id)) }),
          schema: ArtifactDraftSchema,
          fallbackValue: fallback
        });
        if (generated.value.evidenceRefs.some((id) => !confirmedIds.has(id))) {
          throw new ModelGatewayError('Artifact referenced evidence that was not user-confirmed.', { code: 'untrusted_evidence_reference', retryable: false });
        }
        state.artifactDraft = generated.value;
      }

      await repository.appendEvent({
        runId: run.id,
        type: 'step.completed',
        step,
        payload: {
          ...providerInfo,
          schemaValidated: true,
          resultSummary: step === 'analyze_requirements'
            ? { requirementCount: state.requirements.length }
            : step === 'match_candidate_evidence'
              ? { totalScore: state.matchReport.totalScore }
              : { outputKey: step.replace(/^(create_|diagnose_)/, '') }
        }
      });
    } catch (error) {
      await repository.appendEvent({
        runId: run.id,
        type: 'step.failed',
        step,
        payload: { ...providerInfo, message: error.message }
      });
      throw error;
    }
  }

  return CareerOutputSchema.parse({
    requirements: state.requirements.map(({ id, text, category, hardGate }) => ({ id, text, category, hardGate })),
    matchReport: state.matchReport,
    gapDiagnosis: state.gapDiagnosis,
    preparationPlan: state.preparationPlan,
    artifactDraft: state.artifactDraft
  });
}
