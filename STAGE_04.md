# STAGE_04.md

## Objective
Compute derived metrics for each Results dataset and display them under the table.

## Scope
1. Metrics computation in Domain
2. Display only, no charts yet

## Metrics to compute
1. Total frequency shift for S11, 0 to 1000 mg per dL
2. Total frequency shift for S21, 0 to 1000 mg per dL
3. Total frequency shift for S11, 72 to 600 mg per dL if both exist
4. Sensitivity for S11, MHz per mg per dL, based on available endpoints
5. Amplitude delta for S11 and S21 using endpoints

## Deliverables
1. Metrics panel shown per dataset
2. Metrics update instantly when table changes
3. If endpoints missing, show not available

## Files to create or modify
1. static/js/domain/metrics.js
2. static/js/domain/validators.js
3. static/js/application/results_service.js
4. static/js/presentation/results_view.js

## Acceptance criteria
1. Metrics match manual calculation for a small known dataset
2. No NaN shown to the user, replace with not available
3. Units shown consistently, GHz, dB, MHz per mg per dL

## Manual test checklist
1. Enter 0 and 1000 rows, verify shift and sensitivity populate
2. Remove one endpoint, metrics switch to not available
