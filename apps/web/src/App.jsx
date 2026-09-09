import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

const emptyEvidence = {
  type: 'project',
  title: '',
  content: '',
  skills: '',
  sourceUrl: '',
  proofLinks: '',
  metrics: ''
};

async function request(path, options) {
  const response = await fetch(`${API}${path}`, options);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message ?? body?.error ?? 'Request failed.');
  return body;
}

function splitLines(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function statusLabel(status) {
  return {
    draft: '待确认',
    user_confirmed: '已确认',
    rejected: '已拒绝',
    stale: '已过期',
    matched: '已匹配',
    partial: '待确认',
    missing: '无证据',
    ready: 'Ready',
    weak: 'Weak',
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
    knowledge_review: '知识复习',
    project_deep_dive: '项目深挖',
    coding_practice: '编程练习',
    system_design: '系统设计',
    behavioral_story: '行为面试',
    resume_revision: '简历修订'
  }[status] ?? status;
}

function providerLabel(events) {
  const stepEvent = [...events].reverse().find((event) => event.payload?.provider);
  if (!stepEvent) return 'Supabase · Provider 未启动';
  const { provider, model } = stepEvent.payload;
  return model ? `${provider} · ${model}` : provider;
}

function App() {
  const [jobText, setJobText] = useState('We are hiring an AI Agent Engineer to build RAG applications with LangGraph, Tool Calling, Python, JavaScript, Docker, and evaluation workflows.');
  const [evidence, setEvidence] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [evidenceForm, setEvidenceForm] = useState(emptyEvidence);
  const [editingId, setEditingId] = useState('');
  const [runId, setRunId] = useState('');
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(true);

  useEffect(() => {
    request('/api/evidence')
      .then((body) => {
        setEvidence(body.evidence ?? []);
        setSelectedIds((body.evidence ?? []).map((item) => item.id));
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setEvidenceLoading(false));
  }, []);

  useEffect(() => {
    if (!runId) return undefined;
    let active = true;
    const poll = async () => {
      try {
        const [nextRun, nextEvents] = await Promise.all([
          request(`/api/career-runs/${runId}`),
          request(`/api/career-runs/${runId}/events`)
        ]);
        if (!active) return;
        setRun(nextRun);
        setEvents(nextEvents.events ?? []);
        if (['completed', 'failed', 'cancelled'].includes(nextRun.status)) setLoading(false);
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

  function resetEvidenceForm() {
    setEvidenceForm(emptyEvidence);
    setEditingId('');
  }

  async function saveEvidence(event) {
    event.preventDefault();
    setError('');
    const input = {
      ...evidenceForm,
      sourceUrl: evidenceForm.sourceUrl.trim() || null,
      skills: splitLines(evidenceForm.skills),
      proofLinks: splitLines(evidenceForm.proofLinks),
      metrics: splitLines(evidenceForm.metrics)
    };
    try {
      const body = editingId
        ? await request(`/api/evidence/${editingId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
        : await request('/api/evidence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const saved = body.evidence;
      setEvidence((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      if (!editingId) setSelectedIds((current) => [...current, saved.id]);
      resetEvidenceForm();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  function editEvidence(item) {
    setEditingId(item.id);
    setEvidenceForm({
      type: item.type,
      title: item.title,
      content: item.content,
      skills: item.skills.join(', '),
      sourceUrl: item.sourceUrl ?? '',
      proofLinks: item.proofLinks.join(', '),
      metrics: item.metrics.join(', ')
    });
  }

  async function updateEvidenceStatus(id, verificationStatus) {
    try {
      const body = await request(`/api/evidence/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ verificationStatus })
      });
      setEvidence((current) => current.map((item) => item.id === id ? body.evidence : item));
    } catch (statusError) {
      setError(statusError.message);
    }
  }

  async function deleteEvidence(id) {
    if (!window.confirm('删除这条 Evidence？已有 Run 的快照不会受到影响。')) return;
    try {
      await request(`/api/evidence/${id}`, { method: 'DELETE' });
      setEvidence((current) => current.filter((item) => item.id !== id));
      setSelectedIds((current) => current.filter((item) => item !== id));
      if (editingId === id) resetEvidenceForm();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function toggleEvidence(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function createRun(event) {
    event.preventDefault();
    setError('');
    setRunId('');
    setRun(null);
    setEvents([]);
    setLoading(true);
    try {
      const body = await request('/api/career-runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ jobText, evidenceIds: selectedIds })
      });
      setRunId(body.runId);
    } catch (submitError) {
      setLoading(false);
      setError(submitError.message);
    }
  }

  async function cancelRun() {
    if (!runId) return;
    try {
      const nextRun = await request(`/api/career-runs/${runId}/cancel`, { method: 'POST' });
      setRun(nextRun);
      setLoading(false);
    } catch (cancelError) {
      setError(cancelError.message);
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
        <div className="status-pill"><span /> {providerLabel(events)}</div>
      </header>

      <section className="grid">
        <div className="left-column">
          <form className="card intake" onSubmit={createRun}>
            <div className="card-heading"><div><p className="eyebrow">01 / INTAKE</p><h2>运行一个岗位分析</h2></div><span className="badge">V1</span></div>
            <label>JD 文本<textarea value={jobText} onChange={(event) => setJobText(event.target.value)} rows={8} /></label>
            <div className="selection-summary">已选择 {selectedIds.length} / {evidence.length} 条 Evidence</div>
            <button disabled={loading || jobText.length < 30}>{loading ? 'Agent 正在运行…' : '运行 Career Workflow'}</button>
            {loading && <button className="secondary-button" type="button" onClick={cancelRun}>取消当前 Run</button>}
          </form>

          <section className="card vault">
            <div className="card-heading"><div><p className="eyebrow">02 / EVIDENCE VAULT</p><h2>候选人事实库</h2></div><span className="badge">{evidence.length} items</span></div>
            <form className="evidence-form" onSubmit={saveEvidence}>
              <input placeholder="标题，例如 Agent Workbench" value={evidenceForm.title} onChange={(event) => setEvidenceForm({ ...evidenceForm, title: event.target.value })} required />
              <textarea placeholder="描述真实做过的工作、边界和结果" value={evidenceForm.content} onChange={(event) => setEvidenceForm({ ...evidenceForm, content: event.target.value })} rows={4} required />
              <input placeholder="技能，逗号分隔：Agent, RAG, JavaScript" value={evidenceForm.skills} onChange={(event) => setEvidenceForm({ ...evidenceForm, skills: event.target.value })} />
              <input placeholder="来源链接，可选，例如 GitHub README" type="url" value={evidenceForm.sourceUrl} onChange={(event) => setEvidenceForm({ ...evidenceForm, sourceUrl: event.target.value })} />
              <input placeholder="证明链接，可选，逗号分隔" value={evidenceForm.proofLinks} onChange={(event) => setEvidenceForm({ ...evidenceForm, proofLinks: event.target.value })} />
              <input placeholder="量化指标，可选，逗号分隔" value={evidenceForm.metrics} onChange={(event) => setEvidenceForm({ ...evidenceForm, metrics: event.target.value })} />
              <div className="form-actions"><button type="submit">{editingId ? '保存修改' : '新增 Evidence'}</button>{editingId && <button type="button" className="secondary-button" onClick={resetEvidenceForm}>取消编辑</button>}</div>
            </form>
            {evidenceLoading && <div className="empty compact">正在读取 Evidence…</div>}
            {!evidenceLoading && evidence.length === 0 && <div className="empty compact">先添加一条真实项目或经历。新建内容默认是“待确认”。</div>}
            <div className="evidence-list">{evidence.map((item) => <article className="evidence-item" key={item.id}>
              <div className="evidence-top"><label className="check"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleEvidence(item.id)} /><span /></label><div><strong>{item.title}</strong><small>{item.type} · {statusLabel(item.verificationStatus)}</small></div><span className={`badge evidence-status ${item.verificationStatus}`}>{statusLabel(item.verificationStatus)}</span></div>
              <p>{item.content}</p>
              {item.skills.length > 0 && <div className="tags">{item.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>}
              <div className="item-actions"><button type="button" className="link-button" onClick={() => editEvidence(item)}>编辑</button>{item.verificationStatus !== 'user_confirmed' && <button type="button" className="link-button confirm" onClick={() => updateEvidenceStatus(item.id, 'user_confirmed')}>确认</button>}{item.verificationStatus === 'user_confirmed' && <button type="button" className="link-button" onClick={() => updateEvidenceStatus(item.id, 'stale')}>标记过期</button>}<button type="button" className="link-button danger" onClick={() => deleteEvidence(item.id)}>删除</button></div>
            </article>)}</div>
          </section>
        </div>

        <section className="card trace">
          <div className="card-heading"><div><p className="eyebrow">03 / TRACE & RESULT</p><h2>可读执行轨迹</h2></div>{run && <span className={`badge ${run.status}`}>{run.status}</span>}</div>
          {!runId && <div className="empty">运行 JD 后，这里会显示每个 Agent Step、Schema 校验、证据引用和最终结果。</div>}
          {runId && <><div className="run-meta">Run <code>{runId}</code></div><div className="events">{events.map((event) => <div className="event" key={`${event.runId}-${event.sequence}`}><span className={`event-dot ${event.type.includes('failed') ? 'failed' : ''}`} /><div><strong>{event.type}</strong><span>{event.step ?? 'career-run'}</span><small>{event.payload?.description ?? event.payload?.message ?? (event.payload?.schemaValidated ? 'Schema validated' : '')}</small></div></div>)}</div></>}
          {run?.status === 'completed' && run.output && <div className="result">
            <div className="score">{run.output.matchReport.totalScore}<small>/100 confirmed match</small></div>
            <p className="result-meta">解析 {run.output.requirements.length} 条岗位要求 · 生成 {run.output.preparationPlan.length} 项准备任务</p>
            <h3>Requirement Match</h3>
            {run.output.matchReport.requirements.map((item) => <div className="match" key={item.id}>
              <div className="match-heading"><strong>{item.text}</strong><span className={`badge ${item.status}`}>{statusLabel(item.status)}</span></div>
              <small>{item.reason}</small>
              <code>{item.evidenceRefs.length > 0 ? item.evidenceRefs.join(', ') : 'no evidence reference'}</code>
            </div>)}
            <h3>Gap Diagnosis</h3>
            {run.output.gapDiagnosis.map((gap) => <div className="gap" key={gap.requirementId}>
              <span className={gap.status}>{statusLabel(gap.status)}</span>
              <div><strong>{gap.explanation}</strong><small>{gap.nextAction}</small></div>
            </div>)}
            <h3>Preparation Plan</h3>
            {run.output.preparationPlan.map((task) => <div className="prep" key={task.id}>
              <div className="prep-heading">
                <strong>{task.title}</strong>
                <span className={`badge priority-${task.priority}`}>{statusLabel(task.priority)}</span>
              </div>
              <small>{statusLabel(task.type)}</small>
            </div>)}
            <h3>Artifact Draft</h3>
            <pre>{run.output.artifactDraft.content}</pre>
          </div>}
          {run?.status === 'failed' && <div className="error result-error">Run failed: {run.error}</div>}
          {run?.status === 'cancelled' && <div className="empty compact">Run 已取消，已生成的 Trace 仍然保留。</div>}
        </section>
      </section>
      {error && <div className="global-error">{error}</div>}
    </main>
  );
}

export default App;
