# STAGE_02.md

## Objective
Create Results tab content skeleton with 6 sub tabs and an empty data table template per dataset.

## Scope
1. Results only
2. No persistence yet
3. Manual row add and delete only

## Deliverables
1. Results tab has 6 dataset sub tabs
2. Each dataset shows a table with the required columns
3. Add row button adds a blank row
4. Delete row removes that row

## Table columns
1. Glucose mg per dL
2. S11 resonance frequency GHz
3. S11 amplitude dB
4. S21 resonance frequency GHz
5. S21 amplitude dB

## Files to create or modify
1. static/js/presentation/results_view.js
2. static/js/domain/models.js
3. templates/index.html

## Acceptance criteria
1. Six sub tabs exist and switch correctly
2. Each dataset has its own independent table state in memory
3. Rows can be added and removed

## Manual test checklist
1. Open Results, select felt 1 ring, add 2 rows
2. Switch to jeans 3 ring, table is empty
3. Return to felt 1 ring, rows still there in memory
