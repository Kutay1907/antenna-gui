# STAGE_08.md

## Objective
Compute optimization metrics per run and rank runs.

## Scope
1. Compute shift and sensitivity from parsed pairs
2. Show a sortable table, default sorted by sensitivity descending

## Metrics per run
1. Total shift, 0 to 1000 using frequency endpoints
2. Sensitivity, MHz per mg per dL
3. Amplitude delta using amplitude endpoints
4. Optional, store best and worst amplitude across the list

## Deliverables
1. Metrics panel per run
2. Runs table includes key metrics columns
3. Top run highlighted

## Files to create or modify
1. static/js/domain/metrics.js
2. static/js/application/optimization_service.js
3. static/js/presentation/optimization_view.js

## Acceptance criteria
1. Ranking updates immediately after parsing pairs
2. Missing endpoints show not available and do not break ranking
3. Calculations match manual check for a small dataset

## Manual test checklist
1. Create 2 runs with different total shift, verify ranking
