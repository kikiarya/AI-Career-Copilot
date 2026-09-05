import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

const starterEvidence = [
  {
    id: 'evidence_demo_agent',
    type: 'project',
    title: 'Evidence-grounded Agent Workbench',
    content: 'Built a JavaScript Agent workflow with structured outputs, tool policy, trace events, and evidence references.',
    skills: ['Agent', 'JavaScript', 'Tool Calling', 'RAG'],
    sourceType: 'manual',
    verificationStatus: 'user_confirmed',
    proofLinks: [],
    metrics: []
  }
];

function App() {
  const [jobText, setJobText] = useState('We are hiring an AI Agent Engineer to build RAG applications with LangGraph, Tool Calling, Python, JavaScript, Docker, and evaluation workflows.');
  const [evidenceText, setEvidenceText] = useState(JSON.stringify(starterEvidence, null, 2));
  const [runId, setRunId] = useState('');
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!runId) return undefined;
    let active = true;
    const poll = async () => {
      try {
        const [runResponse, eventsResponse] = await Promise.all([
          fetch(`${API}/api/career-runs/${runId}`),
          fetch(`${API}/api/career-runs/${runId}/events`)
        ]);
        if (!runResponse.ok || !eventsResponse.ok) throw new Error('无法读取 Career Run。');
        const nextRun = await runResponse.json();
        const nextEvents = await eventsResponse.json();
        if (!active) return;
        setRun(nextRun);
        setEvents(nextEvents.events ?? []);
        if (nextRun.status === 'completed' || nextRun.status === 'failed') setLoading(false);
      } catch (pollError) {
        if (active) setError(pollError.message);
      }
    };
    poll();
    const timer = window.setInterval(poll, 1200);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [runId]);

  async function createRun(event) {
    event.preventDefault();
    setError('');
    setRun(null);
    setEvents([]);
    setLoading(true);
    try {
      const evidence = JSON.parse(evidenceText);
      const response = await fetch(`${API}/api/career-runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ jobText, evidence })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? '创建任务失败。');
      setRunId(body.runId);
    } catch (submitError) {
      setLoading(false);
      setError(submitError.message);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">LOCAL-FIRST AGENT WORKBENCH</p>
          <h1>AI Career Copilot</h1>
          <p className="lede">把岗位要求、候选人 Evidence 和面试准备串成一条可追踪的 Agent 工作流。</p>
        </div>
        <div className="status-pill"><span /> Mock Provider · Local</div>
      </header>

      <section className="grid">
        <form className="card intake" onSubmit={createRun}>
          <div className="card-heading"><div><p className="eyebrow">01 / INTAKE</p><h2>输入一个岗位</h2></div><span className="badge">V1</span></div>
          <label>JD 文本<textarea value={jobText} onChange={(event) => setJobText(event.target.value)} rows={9} /></label>
          <label>已确认 Evidence（JSON）<textarea className="code" value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} rows={10} /></label>
          <button disabled={loading || jobText.length < 30}>{loading ? 'Agent 正在运行…' : '运行 Career Workflow'}</button>
          {error && <p className="error">{error}</p>}
        </form>

        <section className="card trace">
          <div className="card-heading"><div><p className="eyebrow">02 / TRACE</p><h2>可读执行轨迹</h2></div>{run && <span className={`badge ${run.status}`}>{run.status}</span>}</div>
          {!runId && <div className="empty">提交 JD 后，这里会显示每个 Agent Step、Schema 校验和最终结果。</div>}
          {runId && <div className="run-meta">Run <code>{runId}</code></div>}
          <div className="events">{events.map((event) => <div className="event" key={`${event.runId}-${event.sequence}`}><span className="event-dot" /><div><strong>{event.type}</strong><span>{event.step ?? 'career-run'}</span><small>{event.payload?.description ?? (event.payload?.schemaValidated ? 'Schema validated' : '')}</small></div></div>)}</div>
          {run?.status === 'completed' && run.output && <div className="result"><div className="score">{run.output.matchReport.totalScore}<small>/100 match</small></div><h3>Gap Diagnosis</h3>{run.output.gapDiagnosis.map((gap) => <div className="gap" key={gap.requirementId}><span className={gap.status}>{gap.status}</span><div><strong>{gap.explanation}</strong><small>{gap.nextAction}</small></div></div>)}<h3>Artifact Draft</h3><pre>{run.output.artifactDraft.content}</pre></div>}
        </section>
      </section>
    </main>
  );
}

export default App;
