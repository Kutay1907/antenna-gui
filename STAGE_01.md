# STAGE_01.md

## Objective
Add a tab bar with three tabs, Calculator, Results, Parameter Optimization, without changing the existing calculator logic.

## Scope
1. UI only
2. No persistence yet
3. No tables yet

## Deliverables
1. Tab bar rendered at the top
2. Clicking a tab shows the related section and hides the others
3. Default tab is Calculator
4. URL hash routing optional, not required

## Files to create or modify
1. templates/index.html
2. static/css/app.css
3. static/js/presentation/tabs_controller.js
4. static/js/app_bootstrap.js

## Acceptance criteria
1. All three tabs visible
2. Switching tabs does not reload the page
3. Calculator tab still works exactly as before

## Manual test checklist
1. Load page, Calculator visible
2. Click Results, Calculator hidden, Results section visible
3. Click Parameter Optimization, only that section visible
4. Return to Calculator, behavior unchanged
