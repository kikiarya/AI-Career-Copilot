# AI Career Copilot

AI Career Copilot 是一个把岗位要求与候选人经历证据连接起来的求职准备工作台。用户维护自己的经历证据，提交职位描述后，系统创建一次可追踪的 Career Run，依次完成岗位要求解析、证据匹配、差距诊断、准备计划和求职材料草稿。

## 当前功能

- **经历证据管理**：创建、编辑、确认、标记过期和删除 Evidence；证据可以关联经历、技能和证明链接。
- **岗位分析**：提交 JD 后提取结构化岗位要求，并生成技能标签、差距诊断和准备计划。
- **证据匹配**：把岗位要求与本次选择的 Evidence 关联；当前匹配由关键词规则完成，结果保留可查看的要求与证据关系。
- **材料草稿**：基于已确认的 Evidence 生成可编辑的求职材料草稿，并校验草稿引用的 Evidence ID 属于本次已确认证据集合。
- **异步 Career Run**：API 创建任务后由独立 Worker 执行；Run 保存提交时的 Evidence 快照，不受之后证据修改影响。
- **执行追踪**：记录工作流步骤的开始、完成和失败事件；网页可查看 Run 状态、步骤摘要和错误信息。
- **模型适配**：Model Gateway 支持 Mock 和 OpenAI-compatible Chat Completions；提供请求超时、有限 HTTP 重试、JSON 解析、Zod 校验和一次结构修复。
- **后台任务恢复**：Worker 使用任务租约和 heartbeat 领取任务；过期任务可重新进入队列，并按有限次数重试。

## 一次 Career Run

```text
analyze_requirements
→ match_candidate_evidence
→ diagnose_gaps
→ create_preparation_plan
→ create_artifact_draft
```

要求解析、差距诊断、准备计划和材料草稿通过 Model Gateway 生成结构化结果；证据匹配使用关键词规则。材料草稿只接收已确认的证据。匹配分数按“已匹配要求数 / 提取要求数”计算，用于描述本次证据覆盖情况，不代表录用概率。

## 系统结构

```text
React + Vite Web
        ↓
Express API ───── Supabase PostgreSQL
        ↓                 ↑
Node Worker ─────────────┘
        ↓
五步工作流 → Contracts / Zod → Model Gateway → Mock 或兼容模型服务
```

| 模块 | 当前职责 |
|---|---|
| `apps/web` | Evidence 管理、JD 提交、Run 结果和执行事件展示 |
| `apps/api` | 请求校验、Evidence CRUD、Career Run 创建/查询/取消和事件查询 |
| `apps/worker` | 领取异步任务、heartbeat、重试和五步工作流执行 |
| `packages/contracts` | API、Evidence、Run 和工作流结果的 Zod 契约 |
| `packages/persistence` | 内存与 Supabase Repository |
| `packages/model-gateway` | Mock / OpenAI-compatible 模型调用及结构化输出校验 |
| `supabase/migrations` | Evidence、Career Run、事件表及队列相关数据库定义 |

## 本地运行

环境要求：Node.js 22、仓库指定版本的 pnpm。配置 Supabase 后端连接信息后，在项目根目录运行：

```powershell
pnpm.cmd install --frozen-lockfile
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

在 `.env` 中配置开发 Supabase 项目：

```ini
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-backend-secret
MODEL_PROVIDER=mock
```

将 `supabase/migrations` 中的数据库迁移应用到该开发项目，然后启动前端、API 和 Worker：

```powershell
pnpm.cmd dev
```

Web 地址为 `http://localhost:5173`，API 健康检查为 `http://localhost:8787/health`。

要切换到 OpenAI-compatible 服务，在 `.env` 中设置：

```ini
MODEL_PROVIDER=openai-compatible
MODEL_BASE_URL=https://your-provider.example/v1
MODEL_NAME=your-provider-model
MODEL_API_KEY=your-local-secret
```

模型密钥只用于后端进程，不应放入前端环境变量。

## 常用检查

```powershell
pnpm.cmd check
pnpm.cmd test
pnpm.cmd --filter @copilot/web build
```

## 仓库结构

```text
apps/web                 React + Vite 求职工作台
apps/api                 Express API
apps/worker              异步任务 Worker 与 Career Run 工作流
packages/contracts       共享 Zod 契约
packages/persistence     内存与 Supabase 数据访问
packages/model-gateway   Mock 与 OpenAI-compatible 模型适配
supabase/migrations      数据库迁移
```
