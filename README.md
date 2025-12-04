# GenAI Log Analysis & Mini RAG Assistant

This project implements a small Retrieval-Augmented Generation (RAG) stack that ingests a curated corpus, stores embeddings in a FAISS vector store, and serves a FastAPI endpoint that a Node.js CLI can query. It also includes an error log analysis workflow that summarizes failures and proposes remediations.

## High-Level Design

- **Corpus & Chunking**: Four markdown documents in `data/docs/` capture RAG, Azure deployment, observability, and incident response practices. `rag/ingest.py` cleans, chunks (~520 characters with 80-character overlap), embeds via `all-MiniLM-L6-v2`, and saves a FAISS index plus JSON metadata.
- **Vector Store**: Embeddings live in `artifacts/vector_store.faiss`; chunk metadata (source doc ID and text) lives in `artifacts/chunks.json`. Both are produced offline during CI or local setup.
- **Retrieval Service**: `rag/rag_service.py` loads the index and exposes `/query` and `/healthz` via FastAPI. It embeds incoming questions, retrieves the top 4 chunks with cosine similarity, and crafts a prompt for a lightweight `google/flan-t5-small` text-generation pipeline.
- **Node.js Frontend**: `frontend/cli/index.mjs` is a minimal CLI that posts user queries to the FastAPI endpoint and prints the model answer plus retrieved contexts.
- **Log Analysis**: `analysis/log_analysis.py` parses sample web, database, and application logs in `data/logs/`, detecting patterns such as upstream timeouts, failover events, and circuit-breaker trips. It emits a Markdown report in `reports/log_analysis_report.md` with issues, root causes, and actionable solutions.
- **Cloud-Friendly Deployment**: The Python API can be containerized and hosted on Azure Container Apps. The FAISS artifacts can be mounted from Azure Files/Blob Storage. The Node CLI can run anywhere with network access to the API (or be swapped for a static web UI).

## Architecture Flow

1. **Ingestion**
   - Read docs → clean and chunk → embed with `SentenceTransformer` → store FAISS index + chunk metadata.
2. **Serving**
   - FastAPI boots, loads FAISS, instantiates embedder + generator, exposes `/query`.
3. **Frontend**
   - Node CLI sends POST `/query {question}` → receives answer + contexts.
4. **Monitoring & Guardrails**
   - Health endpoint `/healthz` for probes; prompts keep answers grounded to retrieved contexts; sample logs illustrate alertable conditions.

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### Install Python dependencies
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Build the vector index
```bash
python rag/ingest.py
```
This populates `artifacts/vector_store.faiss` and `artifacts/chunks.json`.

### Run the FastAPI service
```bash
uvicorn rag.rag_service:app --reload --host 0.0.0.0 --port 8000
```

### Query via Node CLI
In a separate shell:
```bash
cd frontend/cli
npm run query -- "How do we deploy the RAG service on Azure?"
```
The CLI prints the generated answer and the retrieved supporting contexts.

### Log analysis report
```bash
python analysis/log_analysis.py
cat reports/log_analysis_report.md
```

## Cloud Deployment Notes (Azure example)

- **Containerization**: Use a multi-stage Dockerfile to install Python deps, download models, and copy the FAISS artifacts generated in CI. Expose port 8000.
- **Storage**: Mount Azure Files or download from Blob Storage on startup so every replica can access `vector_store.faiss` and `chunks.json`.
- **Networking**: Front the API with Azure Application Gateway WAF + managed certificates. Use private endpoints for storage and Key Vault. Add `/healthz` probes for Container Apps autoscaling.
- **Observability**: Emit structured JSON logs and OpenTelemetry traces. Track embedding latency, recall, and generation time. Ship logs to Log Analytics with correlation IDs linking the Node client and API.
- **Safety & Quality**: Enforce prompt size limits, add refusal policies for disallowed content, and schedule periodic re-embedding when documents change.

## Repository Layout

- `data/docs/` – corpus documents for RAG.
- `data/logs/` – sample web/database/application logs for troubleshooting exercises.
- `rag/ingest.py` – corpus chunking and FAISS index builder.
- `rag/rag_service.py` – FastAPI inference service with retrieval + generation.
- `frontend/cli/` – Node CLI to hit the API.
- `analysis/log_analysis.py` – heuristic log parsing and Markdown report generator.
- `reports/` – generated reports (log analysis).
- `requirements.txt` – Python dependencies.

## Learnings & Challenges

- **Model Footprint**: Using `google/flan-t5-small` keeps inference local and cloud-friendly, but longer answers may need a larger model or an external provider (OpenAI/Azure OpenAI).
- **Index Initialization**: Serving relies on pre-built FAISS artifacts; readiness probes should fail until these files are present to avoid runtime `NameError` scenarios.
- **Latency Risks**: External embedding APIs can trigger circuit breakers. Keeping a local embedding model (`all-MiniLM-L6-v2`) mitigates outages and simplifies offline testing.
- **Future Extensions**: Add reranking, streaming responses, a browser UI, and CI smoke tests that validate retrieval quality on a golden question set.
