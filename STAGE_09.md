# STAGE_09.md

## Objective
Add export and import for the full project state.

## Scope
1. Export all Results datasets and Optimization runs as one JSON file
2. Import the same JSON and restore state
3. Add optional CSV export per dataset, keep minimal

## Deliverables
1. Export button downloads JSON
2. Import button accepts JSON file and restores
3. Validation of imported schema, reject incompatible files with a message

## Files to create or modify
1. static/js/application/export_import_service.js
2. static/js/infrastructure/file_adapter.js
3. static/js/infrastructure/storage_repository.js
4. static/js/presentation/results_view.js
5. static/js/presentation/optimization_view.js

## Acceptance criteria
1. Export then clear then import restores everything
2. Import of invalid JSON does not corrupt existing state
3. Version field included in exported JSON for forward compatibility

## Manual test checklist
1. Enter data in 2 datasets and 1 optimization run, export, clear, import, verify
