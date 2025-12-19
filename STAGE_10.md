# STAGE_10.md

## Objective
Stabilization and hardening, validation, error handling, and minimal regression checks.

## Scope
1. Validation for numeric ranges and missing fields
2. Consistent formatting and units
3. Prevent chart duplication and memory leaks
4. Add a minimal manual regression checklist

## Deliverables
1. Centralized validation errors shown near the affected component
2. All calculations guarded against empty input
3. No UI crashes on edge cases

## Files to create or modify
1. static/js/domain/validators.js
2. static/js/presentation/results_view.js
3. static/js/presentation/optimization_view.js
4. static/js/presentation/charts_view.js

## Acceptance criteria
1. Empty state is stable across all tabs
2. Invalid numeric input shows a clear error
3. Switching tabs repeatedly does not create extra charts

## Manual regression checklist
1. Calculator tab still works
2. Results, add rows, metrics update
3. Charts render and update
4. Optimization, parse pairs, ranking updates
5. Export and import works
