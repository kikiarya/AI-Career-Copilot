# AI Career Copilot：完整项目设计与 PRD

## 1. 项目定位

项目名称`AI Career Copilot`

定位：

> 面向 AI Agent、LLM 应用、RAG、MCP、模型后训练等岗位的 AI 求职与面试准备工作台。

它不是单纯的简历生成器，而是覆盖：

```text

JD 导入

→ 岗位要求解析

→ 简历/项目证据匹配

→ 能力差距诊断

→ 定向学习计划

→ 针对性刷题与面试模拟

→ 答案评估

→ 简历和沟通材料生成

→ 投递记录

→ 结果追踪

→ 反馈分析与持续改进

```

本项目与其他既有业务项目保持独立边界，使用 JavaScript MVP，但从第一天开始使用 Monorepo、共享 Zod Schema 和模块化边界，为后续迁移 TypeScript 做准备。

## 2. 参考项目与借鉴方向

- [Resume-Matcher]([https://github.com/srbhr/Resume-Matcher)：主简历、岗位定制简历、ATS](https://github.com/srbhr/Resume-Matcher)：主简历、岗位定制简历、ATS) 匹配、PDF 和多模型配置。

- [JobSync]([https://github.com/Gsync/jobsync)：岗位收藏、投递状态、任务记录、AI](https://github.com/Gsync/jobsync)：岗位收藏、投递状态、任务记录、AI) 匹配和求职分析。

- [Applytic]([https://github.com/hardikjp7/applytic)：投递结果、拒信模式、渠道分析和反馈闭环。](https://github.com/hardikjp7/applytic)：投递结果、拒信模式、渠道分析和反馈闭环。)

- [LangGraph.js]([https://github.com/langchain-ai/langgraphjs)：状态图、长任务、暂停恢复和人工确认。](https://github.com/langchain-ai/langgraphjs)：状态图、长任务、暂停恢复和人工确认。)

- [Dify]([https://github.com/langgenius/dify)：Agent](https://github.com/langgenius/dify)：Agent) 工作流、RAG、工具调用和运行观测。

- [Open WebUI]([https://github.com/open-webui/open-webui)：多模型、自定义](https://github.com/open-webui/open-webui)：多模型、自定义) API、MCP、RAG、记忆和本地部署。

- [LiteLLM]([https://github.com/BerriAI/litellm)：多模型统一接口、Fallback、成本和](https://github.com/BerriAI/litellm)：多模型统一接口、Fallback、成本和) Token 统计。

- [Ragas]([https://github.com/vibrantlabsai/ragas)：RAG](https://github.com/vibrantlabsai/ragas)：RAG) 评测、答案质量评估和回归测试。

## 3. 目标用户与角色

### MVP

主要角色只有一个：

- Candidate：个人求职者，管理自己的简历、项目、岗位、练习和投递记录。

### V2

可增加：

- Reviewer：导师或朋友，查看候选人主动分享的简历、答案和诊断结果。

- Admin：管理 Prompt、模型供应商、系统配置和评测集。

MVP 按多用户架构设计，但不实现复杂团队协作。

## 4. 核心产品模块

### 4.1 个人档案与证据库

用户维护一份“事实型职业档案”：

- 基本信息；

- 教育经历；

- 技能；

- 项目；

- 实习经历；

- 竞赛和论文；

- GitHub 仓库；

- 技术栈；

- 可量化成果；

- 英文自我介绍；

- 目标岗位和城市；

- 薪资、工作模式和行业偏好。

每条经历都拆分成可被 AI 引用的 Evidence：

```json

{

  "id": "evidence_001",

  "type": "project",

  "title": "Multi-Agent Learning Assistant",

  "content": "实现多 Agent 学习工作流、工具权限和结构化输出",

  "skills": ["LangGraph", "RAG", "Zod", "Supabase"],

  "proofLinks": [],

  "metrics": [],

  "verified": true,

  "source": "user_input"

}

```

所有简历、Cover Letter、自我评价和打招呼语只能引用已存在的 Evidence，禁止生成没有事实依据的经历。

### 4.2 JD 导入和岗位分析

支持：

- 粘贴 JD；

- 输入招聘页面 URL；

- 上传 JD 文件；

- 从受支持来源搜索岗位；

- 手动编辑解析结果。

MVP 重点支持“粘贴 JD + URL 抓取”。广泛爬取 LinkedIn、Boss、Indeed 等平台放到后续版本，避免合规和稳定性问题。

JD 分析结果包括：

- 岗位名称；

- 公司；

- 工作地点；

- 技术要求；

- 业务要求；

- 加分项；

- 学历和经验要求；

- 硬性门槛；

- 隐含能力；

- 面试重点；

- 关键词；

- 证据来源。

### 4.3 简历与 JD 匹配

匹配结果不只输出一个分数，而是拆分为：

```text

总匹配度

├── 硬性条件匹配

├── 技术栈匹配

├── 项目证据匹配

├── 经验深度匹配

├── 业务场景匹配

├── 面试风险

└── 缺失证据

```

每项结果必须能追溯到：

- JD requirement ID；

- candidate evidence ID；

- 检索来源；

- 匹配理由；

- 匹配置信度。

示例：

```json

{

  "requirement": "具备 RAG 系统开发经验",

  "status": "matched",

  "evidenceRefs": ["evidence_001"],

  "reason": "项目中实现了课程知识检索和 Agent 上下文注入",

  "confidence": 0.86

}

```

### 4.4 能力差距诊断

诊断分为三类：

- Ready：已有充分证据，可以直接用于简历和面试；

- Weak：有基础，但缺少深度或量化成果；

- Missing：JD 要求中暂时没有证据。

诊断输出：

- 技术差距；

- 项目表达差距；

- 面试知识差距；

- 需要补充的项目证据；

- 推荐练习顺序；

- 面试风险；

- 是否建议投递。

系统不得用“缺少证据”直接判定“不会”，而是区分：

```text

没有经历

有经历但没有写入档案

有经历但证据不足

有技能但缺乏岗位相关性

```

### 4.5 定向学习和面试准备

针对每个 JD 生成 Preparation Plan：

- 需要掌握的知识点；

- 需要补充的项目讲解；

- 需要准备的 STAR 故事；

- 预计面试题；

- 复习优先级；

- 每项任务预计耗时；

- 完成状态；

- 复习结果。

学习任务类型：

```text

knowledge_review

project_deep_dive

coding_practice

system_design

behavioral_story

mock_interview

resume_revision

```

### 4.6 针对性题目生成

题目来源：

- JD 技术要求；

- 用户项目；

- 用户薄弱点；

- 岗位常见面试方向；

- 历史答错题；

- 用户指定主题。

题目类型：

- 技术概念题；

- 场景设计题；

- 系统设计题；

- 项目深挖题；

- 编程题；

- 行为面试题；

- 追问链问题。

每道题包含：

- 题目；

- 目标知识点；

- 难度；

- 推荐答题结构；

- 评分标准；

- 参考证据；

- 可能追问；

- 常见错误。

### 4.7 答案评估

评估分为：

- 技术正确性；

- 岗位相关性；

- 结构清晰度；

- 证据充分性；

- 细节深度；

- 表达自然度；

- 追问抗压能力；

- 是否存在夸大或编造。

最终输出：

```json

{

  "score": 78,

  "dimensions": {

    "correctness": 82,

    "relevance": 88,

    "depth": 65,

    "clarity": 79

  },

  "strengths": [],

  "weaknesses": [],

  "missingEvidence": [],

  "followUpQuestions": [],

  "nextActions": []

}

```

客观题优先使用规则判分；主观题使用模型结合 Rubric 评分。模型不能直接修改用户掌握度，必须由确定性业务服务校验后写入。

### 4.8 求职材料生成

支持生成：

- 定制简历；

- 项目介绍；

- 自我评价；

- 求职信；

- HR 打招呼语；

- 内推请求语；

- 面试后感谢语；

- Follow-up 跟进语；

- “为什么适合这个岗位”；

- “为什么想加入这家公司”；

- 面试自我介绍；

- 英文版材料。

所有材料必须：

- 标记使用了哪些 Evidence；

- 标记哪些内容是 AI 推断；

- 禁止虚构公司、经历、数字和职责；

- 支持用户编辑；

- 支持复制、下载和版本保存。

系统只生成和保存内容，不发送邮件、不发送私信、不自动申请岗位。

### 4.9 投递管理

岗位状态：

```text

saved

interested

preparing

applied

online_assessment

phone_screen

technical_interview

onsite

offer

rejected

withdrawn

ghosted

closed

```

每次状态变化生成 Application Event：

- 时间；

- 状态；

- 备注；

- 使用的简历版本；

- 使用的沟通材料；

- 面试反馈；

- 下一步行动；

- Follow-up 日期。

### 4.10 投递结果分析

系统分析：

- 哪类岗位回复率更高；

- 哪种简历版本效果更好；

- 哪个渠道效果更好；

- 哪些技能经常被要求但证据不足；

- 哪些面试问题反复答不好；

- 哪类岗位应该减少投入；

- 哪些项目最值得写进简历。

样本不足时只展示观察结果，不生成确定性结论。

## 5. Agent 工作流设计

### 5.1 核心 LangGraph 工作流

```text

ingest_job

→ analyze_requirements

→ retrieve_candidate_evidence

→ match_candidate

→ diagnose_gaps

→ create_prep_plan

→ generate_practice_set

→ await_user_answer

→ evaluate_answer

→ generate_feedback

→ update_readiness

→ decide_replan

```

必要时进入人工确认：

```text

low_confidence

→ awaiting_review

→ approve / edit / reject

→ resume workflow

```

### 5.2 Agent 分工

| Agent | 职责 | 可写入内容 |

|---|---|---|

| Job Analyst | 解析 JD 和岗位上下文 | JD 分析草稿 |

| Evidence Matcher | 匹配用户经历与要求 | 匹配结果 |

| Gap Diagnoser | 诊断能力缺口 | 诊断结果 |

| Prep Planner | 制定学习和面试计划 | 计划草稿 |

| Practice Designer | 生成题目和追问 | 练习集 |

| Answer Evaluator | 根据 Rubric 评估答案 | 评估结果 |

| Artifact Writer | 生成简历和沟通材料 | 材料草稿 |

| Application Analyst | 分析投递结果 | 分析报告 |

Agent 不能直接操作数据库。所有数据库读写必须通过 Tool 和 Service 完成。

### 5.3 共享状态

```js

{

  runId,

  userId,

  jobId,

  status,

  jobRequirements,

  candidateEvidence,

  matchReport,

  gapDiagnosis,

  preparationPlan,

  practiceSet,

  answerSubmission,

  answerEvaluation,

  generatedArtifacts,

  reviewRequest,

  warnings,

  retryCount,

  replanCount,

  error

}

```

每个 Agent 使用 Zod Schema 约束输入和输出。

### 5.4 失败恢复

- Schema 失败：尝试一次结构化修复；

- 模型超时：有限重试；

- RAG 无结果：降低置信度并要求人工确认；

- Tool 越权：拒绝执行并记录；

- 计划写入失败：使用幂等键重试；

- Worker 崩溃：从 checkpoint 恢复；

- Replan 最多执行 2 次；

- 超过预算：停止当前任务并保留失败 Trace。

## 6. RAG 与 Tool Calling

### 6.1 RAG 数据源

候选人私有知识库：

- V1：主简历、手动录入的 Candidate Evidence、用户粘贴的个人经历和岗位 JD；

- V2：项目 README、项目设计文档、技术博客、GitHub 仓库和面试笔记；

- V1/V2：历史答案和已确认的练习反馈。

外部知识库：

- 公司官方招聘页面；

- 公司官方技术博客；

- 官方产品文档；

- GitHub 官方仓库；

- 用户主动提供的网页。

每条检索结果必须保存：

```text

sourceId

sourceType

sourceUrl

contentHash

fetchedAt

chunkId

snippet

metadata

```

### 6.2 检索策略

MVP 使用：

```text

metadata filter

+ PostgreSQL full-text search

+ pgvector semantic search

+ reranking

```

无 embedding API 时降级为全文检索，但必须在 Trace 中记录降级原因。

### 6.3 Agentic RAG 的评测设计

本项目的 RAG 优化必须使用固定 JSONL 评测集，不以单个 Demo 的主观观感作为结论。每条样本至少包含：

```json
{
  "caseId": "career_rag_001",
  "query": "该岗位最看重哪些 Agent 工程能力？",
  "sourceDocumentIds": [],
  "goldChunkIds": [],
  "expectedAnswer": "",
  "mustCite": true,
  "noAnswerExpected": false
}
```

评测分为检索层、生成层和系统层：

- 检索层：Recall@K、Hit@K、MRR、NDCG；
- 上下文层：Context Precision、Context Recall、引用覆盖率；
- 答案层：答案正确性、事实忠实性、无答案判断准确性；
- 系统层：Schema 首次通过率、Tool 拒绝率、P50/P95 延迟、Token 和成本。

每次评测必须输出 baseline、dense、hybrid 和 reranker 的对比报告，并保存：

- 评测集版本；
- Prompt 版本；
- Embedding / Reranker 模型版本；
- 检索参数；
- 每个样本的召回结果和最终引用；
- 失败样本及失败原因。

在实际评测运行前，不得在简历中填写具体提升百分比。评测指标只能标记为目标值、估计值或实测值。

### 6.4 主要 Tools

```text

job.fetch

[job.requirements.read](http://job.requirements.read)

[candidate.evidence.search](http://candidate.evidence.search)

[candidate.profile.read](http://candidate.profile.read)

[technical.knowledge.search](http://technical.knowledge.search)

[application.history.read](http://application.history.read)

practice.create

artifact.create_draft

application.event.create

```

高风险操作：

```text

mastery.update

application.status.update

artifact.mark_used

```

所有高风险写入都必须经过：

```text

Schema 校验

→ 权限校验

→ 业务规则

→ 幂等键

→ 数据库事务

```

## 7. 自定义模型 API 设计

模型配置字段：

```json

{

  "provider": "openai-compatible",

  "name": "DeepSeek",

  "baseUrl": "[https://api.deepseek.com/v1](https://api.deepseek.com/v1)",

  "apiKey": "encrypted",

  "model": "deepseek-chat",

  "embeddingModel": "text-embedding-3-small",

  "temperature": 0.2,

  "maxTokens": 4096,

  "enabled": true

}

```

支持：

- OpenAI；

- DeepSeek；

- Qwen；

- Gemini；

- Claude；

- OpenRouter；

- Ollama；

- vLLM；

- 任意 OpenAI-Compatible API。

任务级模型路由：

```text

JD 解析       → 低成本模型

关键词匹配     → 低成本模型 + 规则

主观答案评估   → 高质量模型

简历生成       → 高质量模型

Embedding      → 用户配置模型

```

安全要求：

- API Key 加密存储；

- 前端永不返回完整 Key；

- 日志不得出现 Key；

- Prompt 和 Trace 做敏感信息脱敏；

- 用户可测试连接；

- 用户可为不同 Agent 指定模型。

## 8. 数据模型

核心业务表：

```text

profiles

candidate_evidence

resume_versions

job_sources

job_postings

job_requirements

career_runs

career_run_steps

match_reports

gap_diagnoses

preparation_plans

preparation_tasks

practice_sets

practice_questions

answer_submissions

answer_evaluations

generated_artifacts

applications

application_events

follow_up_tasks

model_provider_configs

```

Agent 观测表：

```text

agent_runs

agent_steps

tool_calls

retrieval_traces

workflow_events

human_reviews

prompt_versions

evaluation_cases

```

关键约束：

- 所有业务表包含 `user_id`；

- Supabase RLS 按 `user_id` 隔离；

- Artifact 必须关联 `job_id` 和 `evidence_refs`；

- Application Event 只追加，不覆盖历史；

- Agent Run 和 Step 只追加关键事实；

- 所有写入操作支持 `idempotency_key`。

## 9. 系统架构

```text

React + Vite Web

        ↓

Express API

        ↓

Career Service / Repository

        ↓

Postgres-backed Job Queue

        ↓

LangGraph Worker

        ↓

Agent Nodes

        ↓

Tools / RAG / Model Gateway

        ↓

Supabase Postgres + pgvector

```

### 9.1 首版部署策略：Local-first

首版不以云端部署作为开发和验收前置条件，先在本地跑通完整闭环。目标是让开发者可以在一台安装了 Node.js、Docker Desktop 和 Supabase CLI 的 Windows 机器上启动前端、API、Worker、数据库、文件存储模拟环境和代码执行环境。

首版本地拓扑：

```text
React + Vite Web（localhost）
        ↓
Express API（localhost）
        ↓
本地 Supabase Stack：Auth + Postgres + Storage
        ↓
LangGraph Worker（localhost）
        ↓
Docker Code Runner：Python / Java
        ↓
第三方 Model API 或 Mock Provider
```

本地运行约束：

- 使用本地 Supabase Stack 验证 Auth、数据库、Storage 和 RLS；
- 所有异步 Career Run 都由本地 Worker 执行，HTTP 请求只负责创建和查询任务；
- Python 和 Java 代码只能在独立 Docker Runner 中执行；
- Runner 不得访问 Supabase Service Role Key、模型 API Key 或宿主机敏感目录；
- 提供 `.env.example`、数据库迁移、种子数据和一键启动命令；
- Mock Provider 必须可以在没有第三方 API Key 时完成离线演示。

云端迁移不改变领域模型和 Agent Contracts：

- Web 前端可部署到 Vercel 或同类前端平台；
- Auth、Postgres、Storage 和后续 pgvector 可迁移到 Supabase Cloud；
- API、LangGraph Worker 和 Code Runner 部署到支持容器的服务平台；
- 首版不要求完成云端部署，云端部署属于后续发布阶段的工程化工作。

推荐 Monorepo：

```text

ai-career-copilot/

├── apps/

│   ├── web/

│   ├── api/

│   └── worker/

├── packages/

│   ├── contracts/

│   ├── domain/

│   ├── agent-core/

│   ├── model-gateway/

│   ├── retrieval/

│   └── ui/

├── supabase/

│   ├── migrations/

│   ├── seed/

│   └── functions/

├── evals/

│   ├── fixtures/

│   ├── golden/

│   └── reports/

├── docs/

└── package.json

```

## 10. API 设计

### 岗位

```http

POST   /api/jobs/intake

POST   /api/jobs/:jobId/analyze

GET    /api/jobs

GET    /api/jobs/:jobId

PATCH  /api/jobs/:jobId

```

### 求职工作流

```http

POST   /api/career-runs

GET    /api/career-runs/:runId

GET    /api/career-runs/:runId/events

GET    /api/career-runs/:runId/stream

POST   /api/career-runs/:runId/resume

POST   /api/career-runs/:runId/cancel

GET    /api/career-runs/:runId/trace

```

### 练习与答案

```http

GET    /api/career-runs/:runId/practice

POST   /api/practice/:questionId/answer

GET    /api/answers/:answerId/evaluation

```

### 材料

```http

POST   /api/artifacts/generate

GET    /api/artifacts

GET    /api/artifacts/:artifactId

PATCH  /api/artifacts/:artifactId

POST   /api/artifacts/:artifactId/mark-used

```

### 投递

```http

GET    /api/applications

POST   /api/applications

PATCH  /api/applications/:applicationId

POST   /api/applications/:applicationId/events

```

### 模型设置

```http

GET    /api/settings/models

POST   /api/settings/models

PATCH  /api/settings/models/:modelId

POST   /api/settings/models/:modelId/test

```

## 11. 前端页面

### Dashboard

- 今日待办；

- 最近岗位；

- 投递漏斗；

- 当前最薄弱技能；

- 待复习题目；

- Follow-up 提醒；

- 最近生成材料。

### Job Inbox

- 岗位列表；

- 匹配度；

- 投递状态；

- 截止日期；

- 公司和岗位标签；

- 一键进入岗位详情。

### Job Detail

- JD 原文；

- 结构化要求；

- 简历证据匹配；

- 差距诊断；

- 推荐是否投递；

- 开始准备按钮。

### Preparation Studio

- 学习计划；

- 练习题；

- 项目深挖；

- 面试模拟；

- 当前进度；

- Agent 执行状态。

### Artifact Studio

- 简历；

- 自我评价；

- 打招呼语；

- Follow-up；

- Cover Letter；

- 版本对比；

- Evidence 引用；

- 复制和下载。

### Application Tracker

- Kanban 状态；

- 时间线；

- 面试记录；

- 使用的简历版本；

- Follow-up 任务；

- 结果分析。

### Trace & Evaluation

- Workflow 状态图；

- Agent Step；

- Tool Call；

- RAG 证据；

- Token；

- 延迟；

- 重试；

- Schema 错误；

- 人工审核记录。

### Settings

- 模型供应商；

- API Base URL；

- 模型；

- Embedding；

- 默认任务模型；

- 隐私设置；

- 数据导入导出。

## 12. PRD

### 12.1 产品目标

MVP 必须让用户完成：

> 粘贴一份 AI 岗位 JD，得到可信的岗位分析、简历匹配、能力差距、定向练习、答案反馈和一组可编辑求职材料，并能查看每一步 Agent Trace。正式投递记录和结果追踪放到 V2。

### 12.2 非目标

MVP 不实现：

- 自动发送邮件；

- 自动发送私信；

- 自动提交申请；

- 自动处理验证码；

- 绕过招聘网站限制；

- 自动伪造项目经历；

- 完整招聘网站爬虫平台；

- 复杂多人协作；

- 手机 App；

- 自动承诺岗位成功率。

- V1 正式投递管理、投递状态机和投递结果分析。

### 12.3 P0 用户故事

1. 作为求职者，我可以维护自己的主简历和项目证据。

2. 作为求职者，我可以粘贴 JD 并得到结构化分析。

3. 作为求职者，我可以看到每项岗位要求对应的简历证据。

4. 作为求职者，我可以看到自己的能力缺口和面试风险。

5. 作为求职者，我可以生成针对该岗位的学习和面试计划。

6. 作为求职者，我可以完成针对性题目并获得评分。

7. 作为求职者，我可以生成自我评价、打招呼语和 Follow-up 文案。

8. 作为求职者，我可以保存、编辑、复制和下载这些材料。

9. 作为求职者，我可以运行一次从 JD 分析到求职材料生成的可恢复工作流。

10. 作为求职者，我可以查看 Agent 执行过程和引用证据。

11. 作为求职者，我可以配置自定义模型 API。

12. 作为求职者，我可以确认系统不会自动发送任何邮件或消息。

### 12.4 P1 用户故事

- V2：作为求职者，我可以记录岗位投递状态、面试事件、Follow-up 和后续结果。

- 导入 GitHub 仓库自动生成项目证据；

- 根据多个岗位进行横向匹配；

- 分析历史拒信；

- 生成岗位优先级；

- 自动识别 Follow-up 时间；

- 支持英文材料；

- 支持面试录音转文字；

- 支持导师查看分享链接。

### 12.5 关键验收标准

#### JD 匹配

- JD 能被解析成结构化要求；

- 每个匹配结论至少关联一个证据或明确标记“无证据”；

- 匹配结果可以解释，而不是只展示百分比；

- 同一 JD 重复分析时结果可复现或记录模型差异。

#### 材料生成

- 生成材料必须关联 Evidence；

- 无 Evidence 的数字和经历不能自动生成；

- 用户可编辑、复制和下载；

- 系统没有发送邮件、私信或申请请求的后端接口。

#### Agent 工作流

- 创建 Run 后立即返回 `runId`；

- Worker 异步执行；

- 前端可以轮询或通过 SSE 获取状态；

- 服务重启后可以恢复；

- 写入操作不会因重试产生重复数据；

- 低置信度任务会暂停等待确认。

#### 模型配置

- 用户可以配置 OpenAI-Compatible API；

- API Key 不出现在前端响应和日志中；

- 模型连接测试有明确成功/失败结果；

- 模型失败时显示可理解的错误；

- 没有 API Key 时可以使用本地 Mock Provider。

#### 投递记录（V2）

- 可以新增岗位；

- 可以记录投递时间；

- 可以修改状态；

- 可以添加面试和拒信事件；

- 历史事件不能被无痕覆盖；

- 可查看不同简历版本与投递结果关联。

#### 本地闭环

- 新环境可以按照文档启动本地 Web、API、Worker、Supabase Stack 和 Docker Runner；
- 没有第三方 API Key 时可以使用 Mock Provider 完成完整演示；
- 上传的 PDF、DOCX 和纯文本简历可以被解析为待确认 Evidence 草稿；
- Python 和 Java 提交可以在隔离 Docker Runner 中执行，并受到时间、内存和输出大小限制；
- Career Run、文件解析和 Code Run 都能在服务重启后查询到成功、失败或取消状态；
- 云端部署不是 V1 验收条件，但不得依赖本地绝对路径或本地专有状态。

## 13. 评测与测试方案

### 单元测试

- Zod Schema；

- Agent 输入输出；

- Tool 参数；

- 权限校验；

- 幂等写入；

- 状态转移；

- 失败路由；

- 模型配置脱敏；

- 材料 Evidence 约束。

### 工作流测试

- 正常完成；

- JD 解析失败；

- RAG 无命中；

- Schema 修复；

- 模型超时重试；

- Tool 越权；

- 人工暂停与恢复；

- Worker 崩溃恢复；

- 重复提交；

- Replan 上限；

- 用户取消任务。

### 固定评测集

建立 JSONL：

```json

{

  "jobId": "fixture_001",

  "jd": "...",

  "candidateEvidence": [],

  "expectedRequirements": [],

  "expectedMatches": [],

  "expectedRiskFlags": []

}

```

评测指标：

- JD 要求抽取准确率；

- Evidence 匹配准确率；

- 诊断人工确认率；

- 题目与 JD 对齐率；

- 答案评分一致性；

- RAG 证据覆盖率；

- 材料虚构率；

- Schema 首次通过率；

- Tool 拒绝率；

- P50/P95 延迟；

- 单次任务成本。

## 14. 开发阶段

### Phase 0：基础工程（本地优先）

- 创建新 Monorepo；

- React、Express、Worker；

- 本地 Supabase Stack、Auth、RLS 和 Storage；

- 共享 Zod Contracts；

- Mock Model Provider；

- 基础 UI Shell；

- Docker Compose / Supabase CLI 启动脚本和 `.env.example`；

- Python / Java Code Runner 基础镜像。

### Phase 1：旗舰闭环

- 个人档案；

- Evidence Vault；

- JD 导入；

- JD 分析；

- 简历匹配；

- Gap Diagnosis；

- 基础 Preparation Plan。

### Phase 2：练习闭环

- 题目生成；

- 答案提交；

- Rubric 评估；

- Feedback；

- Replan；

- LangGraph checkpoint；

- SSE 状态流；

- Docker 隔离的 Python / Java 编程题执行。

### Phase 3：求职材料（V1）

- 定制简历；

- 自我评价；

- 打招呼语；

- Follow-up；

- Artifact 版本管理；

- Evidence 引用和可读 Trace。

### Phase 3B：投递管理（V2）

- Application Tracker；

- 投递结果分析。

### Phase 4：工程化增强

- RAG 混合检索；

- Embedding、召回、融合排序和 Reranker 对比实验；

- 固定 JSONL RAG Eval 和可复现实验报告；

- Prompt 版本管理；

- Trace 页面；

- 固定评测集；

- 多模型路由；

- 成本统计；

- TypeScript 迁移。

### Phase 5：云端迁移

- 将 Web 前端部署到 Vercel 或同类平台；
- 将 Supabase Stack 迁移到 Supabase Cloud；
- 将 API、Worker 和 Code Runner 部署到容器平台；
- 验证本地与云端的迁移、RLS、文件访问、异步恢复和代码执行边界。

## 15. 简历项目最终表达

项目完成后可以围绕真实证据写成：

> AI Career Copilot：面向 AI Agent/LLM 岗位的 AI 求职与面试准备平台。基于 LangGraph.js 编排“JD 解析→证据匹配→能力诊断→定向计划→练习生成→答案评估→材料生成→投递反馈”的可恢复多 Agent 工作流；使用 RAG 检索岗位要求、候选人项目证据和技术资料，通过 Zod Structured Output、Tool Policy、幂等写入和人工确认保证 Agent 输出可控；基于 React、Node.js/Express、Supabase 和自定义 Model Gateway 实现多模型 API 配置、投递追踪、材料版本管理、Trace 和离线评测闭环。

该表述只有在对应功能、测试和运行证据完成后使用；开发阶段严格区分“已实现”“部分实现”和“计划实现”。

### 15.1 AI Career Copilot 的 RAG 工程化简历表达模板

项目名称：`AI Career Copilot｜Evidence-grounded Agentic RAG 求职与面试准备工作台`

目标表达：

> 构建面向岗位 JD、候选人简历和已确认项目 Evidence 的 Agentic RAG 求职与面试准备工作台；完成文档分块与 Embedding，比较词法、Dense 和 Hybrid 召回，引入二阶段 Reranker，并通过固定 JSONL 评测集对 Recall@K、MRR/NDCG、Context Precision/Recall、答案忠实性、引用覆盖率、延迟和成本进行对比。通过检索 Trace、结构化输出校验、工具策略和无答案降级，使岗位匹配、项目深挖和材料生成能够追溯到具体候选人证据。

这段表达只有在对应代码、实验配置、评测报告和运行 Trace 完成后使用；Embedding、Reranker、RAG Eval 和具体提升百分比在完成前必须标记为 `planned` 或 `unverified`。

