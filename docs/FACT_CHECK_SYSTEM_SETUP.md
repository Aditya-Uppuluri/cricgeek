# Fact-Checking System Setup

This BQS correctness layer now uses three lanes:

1. `direct_match_stat`
   Verified against the live/current scorecard.
2. `historical_structured`
   Verified against a local historical cricket warehouse loaded from Cricsheet JSON.
3. `web_search`
   Verified via Serper or Tavily against trusted cricket/news domains.

## 1. Apply the schema

If you use Prisma directly:

```bash
npx prisma generate
npx prisma db push
```

If you prefer manual SQL, apply:

```bash
prisma/historical_warehouse_migration.sql
```

## 2. Keep web fact-checking configured

Set one search backend:

```env
SERPER_API_KEY=...
```

or

```env
TAVILY_API_KEY=...
```

Optional:

```env
FACT_CHECK_HISTORICAL_ENABLED=true
FACT_CHECK_SEARCH_DEPTH=basic
FACT_CHECK_MAX_WEB_CLAIMS=3
```

## 3. Download historical match data

Use the official Cricsheet JSON download and extract it locally.

Official sources:
- https://cricsheet.org/matches/
- https://cricsheet.org/format/json/

## 4. Import the historical warehouse

Import a whole extracted folder:

```bash
npx tsx scripts/import-cricsheet-history.ts --dir /absolute/path/to/cricsheet-json
```

Import a sample first:

```bash
npx tsx scripts/import-cricsheet-history.ts --dir /absolute/path/to/cricsheet-json --limit 500
```

Import a single match file:

```bash
npx tsx scripts/import-cricsheet-history.ts --file /absolute/path/to/match.json
```

## 5. Rescore blogs

Once the warehouse is loaded, rescore blogs so BQS correctness uses the new historical lane:

```bash
npx tsx scripts/rescore-blog-scores.ts --all
```

## 6. Verify health

Check:

```bash
curl http://localhost:3000/api/health
```

Look for:
- `historicalWarehouseAvailable: true`
- `historicalWarehouseMatchesLoaded > 0`
- `searchConfigured: true`

## 7. What the app does now

- Single-match claims stay on live scorecards.
- Career/history/record claims are routed into the historical warehouse when they match supported query intents.
- News/current/unstructured claims go to web retrieval.
- If the warehouse cannot answer a structured claim, the claim is rerouted to web search instead of being dropped.
