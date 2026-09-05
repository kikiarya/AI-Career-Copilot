# AI Career Copilot

Evidence-grounded Agentic RAG 求职与面试准备工作台。

## V1 本地闭环

```text
JD 文本
→ 结构化要求
→ Candidate Evidence 匹配
→ Gap Diagnosis
→ Preparation Plan
→ 可引用求职材料草稿
→ Agent Trace
```

首版使用 JavaScript ESM、React/Vite、Express、Supabase Cloud、LangGraph-compatible Worker 结构和 Mock Provider。Web、API 和 Worker 在本地运行，数据库连接云端 Supabase。Python/Java 编程题 Runner 将作为独立 Docker 服务加入，不在 API 进程中执行用户代码。

## 项目环境

主应用使用 Node.js + pnpm 管理依赖；每个项目同时维护自己的 Python 虚拟环境 `.venv`，供后续 RAG Eval、文档解析和实验脚本使用。`.venv` 已加入 `.gitignore`，不会提交到 GitHub。

要求：Node.js 22、pnpm 11、Python 3.13、Supabase CLI。Docker Desktop 仅在启用 Python/Java Docker Runner 或使用 Supabase Local 时需要。

创建或重建 Python 虚拟环境：

```powershell
python -m venv .venv
```

激活：

```powershell
.\.venv\Scripts\Activate.ps1
```

退出：

```powershell
deactivate
```

验证：

```powershell
.\.venv\Scripts\python.exe --version
```

## 首次配置 Supabase Cloud

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

将 Supabase Cloud 的 URL、Publishable key 和 Secret key 写入 `.env`。Secret key 只允许 API/Worker 使用，不能进入前端环境变量，也不能提交到 GitHub。

## 日常启动

```powershell
pnpm install
pnpm dev
```

Web：<http://localhost:5173>  
API：<http://localhost:8787/health>  
Supabase Dashboard：<https://supabase.com/dashboard>

如果需要完全本地的 Supabase 开发环境，可以额外执行：

```powershell
supabase start
supabase db reset
```

Local Supabase 需要 Docker Desktop；当前默认开发流程使用 Supabase Cloud，不要求启动 Local Supabase。

## 当前实现边界

- 已实现：共享 Zod Contracts、Supabase schema、Career Run API、异步 Worker、Mock 分析链路、事件 Trace 和 Web 演示。
- 计划实现：真实 Model Gateway、PDF/DOCX 解析、Embedding、Hybrid Retrieval、Reranker、Python/Java Docker Runner、完整 Auth UI。
- 未测量：任何准确率、提升百分比、成本和线上可用性指标。
