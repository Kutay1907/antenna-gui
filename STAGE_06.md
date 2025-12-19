# STAGE_06.md

## Objective
Create Parameter Optimization tab skeleton with a runs table and per run parameter editor.

## Scope
1. UI and in memory state
2. No pair parsing yet
3. No persistence yet for optimization

## Deliverables
1. Optimization tab lists runs
2. Add run, duplicate run, delete run actions
3. Selecting a run opens a parameter form

## Parameter fields
1. Substrate
2. Ring count
3. h
4. G1, G2, G3
5. W1, W2, W3, Ws
6. L1, L2, L3, L4, L5, L6, Lf, Ls
7. Optional box fields, Bheight, Bthick

## Files to create or modify
1. static/js/presentation/optimization_view.js
2. static/js/domain/models.js
3. templates/index.html

## Acceptance criteria
1. Runs list operates correctly
2. Editing parameters affects only the selected run
3. No Results data is modified by this stage

## Manual test checklist
1. Create 2 runs, edit different params, verify separation
