# STAGE_03.md

## Objective
Add LocalStorage persistence for the entire app state, including all 6 Results datasets.

## Scope
1. Persist Results tables
2. Persist selected tabs
3. No metrics yet

## Deliverables
1. Auto save on any table change
2. Restore state on reload
3. Clear data action for Results only

## Files to create or modify
1. static/js/infrastructure/storage_repository.js
2. static/js/application/results_service.js
3. static/js/presentation/results_view.js
4. static/js/presentation/tabs_controller.js

## Acceptance criteria
1. After reload, all entered rows reappear
2. No crashes when LocalStorage is empty or corrupted, show a reset fallback
3. Clear data wipes Results datasets and saves immediately

## Manual test checklist
1. Enter a row in felt 2 ring, reload, row persists
2. Corrupt LocalStorage manually, reload, app recovers with empty state
