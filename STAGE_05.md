# STAGE_05.md

## Objective
Add charts for each Results dataset.

## Scope
1. Three charts per dataset
2. Use Chart.js already used in the project template

## Charts
1. Resonance frequency vs glucose, for S11 and S21 as separate series
2. Amplitude vs glucose, for S11 and S21 as separate series
3. Normalized frequency shift vs glucose, S11 only

## Deliverables
1. Charts render under metrics panel
2. Charts update on data change
3. Charts handle empty dataset gracefully

## Files to create or modify
1. static/js/presentation/charts_view.js
2. static/js/presentation/results_view.js
3. templates/index.html

## Acceptance criteria
1. No duplicate chart instances on tab switching
2. Updates do not leak memory, destroy and recreate properly
3. Empty datasets show empty chart state without errors

## Manual test checklist
1. Add 4 rows, charts update
2. Switch datasets, charts switch correctly
