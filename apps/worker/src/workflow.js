import { CareerOutputSchema } from '@copilot/contracts';

const requirementCatalog = [
  { key: 'langgraph', text: 'LangGraph 或可恢复的 Agent 工作流经验', category: 'agent', hardGate: false },
  { key: 'rag', text: 'RAG、Embedding 或检索系统经验', category: 'retrieval', hardGate: false },
  { key: 'tool calling', text: 'Tool Calling、工具权限或结构化工具协议经验', category: 'agent', hardGate: false },
  { key: 'python', text: 'Python 开发经验', category: 'technical', hardGate: false },
  { key: 'javascript', text: 'JavaScript/Node.js 开发经验', category: 'technical', hardGate: false },
  { key: 'evaluation', text: '模型或 Agent 评测经验', category: 'agent', hardGate: false },
  { key: 'docker', text: 'Docker 或容器化部署经验', category: 'technical', hardGate: false }
];

function detectRequirements(jobText) {
  const lower = jobText.toLowerCase();
  const detected = requirementCatalog.filter((item) => lower.includes(item.key));
  return detected.length > 0
    ? detected.map((item, index) => ({ ...item, id: `req_${index + 1}` }))
    : [
        { id: 'req_1', text: 'AI Agent 应用开发经验', category: 'agent', hardGate: false },
        { id: 'req_2', text: '能够构建可解释、可测试的 LLM 应用', category: 'technical', hardGate: false }
      ];
}

function hasEvidence(requirement, evidence) {
  const haystack = `${evidence.title} ${evidence.content} ${evidence.skills.join(' ')}`.toLowerCase();
  return haystack.includes(requirement.key ?? '') ||
    (requirement.text.includes('Agent') && haystack.includes('agent')) ||
    (requirement.text.includes('LLM') && haystack.includes('llm'));
}

function buildOutput(input) {
  const requirements = detectRequirements(input.jobText);
  const matchRequirements = requirements.map((requirement) => {
    const matches = input.evidence.filter((evidence) => hasEvidence(requirement, evidence));
    const status = matches.length > 0 ? 'matched' : 'missing';
    return {
      id: requirement.id,
      text: requirement.text,
      status,
      evidenceRefs: matches.map((evidence) => evidence.id),
      reason: matches.length > 0
        ? `Matched ${matches.length} candidate evidence item(s).`
        : 'No confirmed candidate evidence was found.',
      confidence: matches.length > 0 ? 0.82 : 0.35
    };
  });

  const matchedCount = matchRequirements.filter((item) => item.status === 'matched').length;
  const totalScore = Math.round((matchedCount / Math.max(requirements.length, 1)) * 100);
  const gapDiagnosis = matchRequirements.map((item) => ({
    requirementId: item.id,
    status: item.status === 'matched' ? 'ready' : 'missing',
    explanation: item.reason,
    nextAction: item.status === 'matched'
      ? 'Prepare a project deep-dive answer with measurable evidence.'
      : 'Add or verify a relevant experience before making a claim.'
  }));

  const preparationPlan = matchRequirements.map((item, index) => ({
    id: `prep_${index + 1}`,
    type: item.status === 'matched' ? 'project_deep_dive' : 'knowledge_review',
    title: item.status === 'matched' ? `Prepare deep-dive: ${item.text}` : `Close gap: ${item.text}`,
    priority: item.status === 'matched' ? 'medium' : 'high'
  }));

  const usableEvidence = input.evidence.filter((item) => item.verificationStatus === 'user_confirmed');
  const artifactLines = usableEvidence.length > 0
    ? usableEvidence.map((item) => `- ${item.title}: ${item.content}`).join('\n')
    : '- No user-confirmed evidence is available yet; review Evidence before using this draft.';

  return CareerOutputSchema.parse({
    requirements,
    matchReport: { totalScore, requirements: matchRequirements },
    gapDiagnosis,
    preparationPlan,
    artifactDraft: {
      title: 'Evidence-grounded application summary',
      content: `This draft only uses user-confirmed evidence.\n\n${artifactLines}`,
      evidenceRefs: usableEvidence.map((item) => item.id),
      unsupportedClaims: usableEvidence.length > 0 ? [] : ['No user-confirmed evidence available.']
    }
  });
}

export async function runCareerWorkflow({ run, repository }) {
  const steps = [
    ['analyze_requirements', 'Extract job requirements from the supplied JD.'],
    ['match_candidate_evidence', 'Match requirements only to supplied Evidence.'],
    ['diagnose_gaps', 'Separate missing evidence from missing ability.'],
    ['create_preparation_plan', 'Create targeted preparation tasks.'],
    ['create_artifact_draft', 'Create an editable, evidence-grounded draft.']
  ];

  for (const [step, description] of steps) {
    await repository.appendEvent({
      runId: run.id,
      type: 'step.started',
      step,
      payload: { description, provider: 'mock', traceVersion: '0.1' }
    });
  }

  const output = buildOutput(run.input);
  for (const [step] of steps) {
    await repository.appendEvent({
      runId: run.id,
      type: 'step.completed',
      step,
      payload: { provider: 'mock', schemaValidated: true }
    });
  }
  return output;
}
