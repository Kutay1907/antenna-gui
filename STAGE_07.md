# STAGE_07.md

## Objective
Implement pair input parsing in Optimization runs, converting frequency amplitude pairs into glucose labeled rows.

## Scope
1. Parse multiline text input
2. Map first pair to 0 mg per dL
3. Map last pair to 1000 mg per dL
4. Linearly fill intermediate glucose values

## Deliverables
1. Text area per run for pair input
2. Parse button or auto parse on change
3. Parsed table preview showing glucose and frequency amplitude columns
4. Clear pairs action

## Mapping rule
If N pairs exist
1. glucose at index i equals 1000 multiplied by i divided by N minus 1
2. glucose is stored as float, display rounded if needed

## Files to create or modify
1. static/js/domain/parser.js
2. static/js/domain/validators.js
3. static/js/application/optimization_service.js
4. static/js/presentation/optimization_view.js

## Acceptance criteria
1. Parser accepts parentheses or no parentheses
2. Parser accepts extra spaces
3. Parser accepts negative amplitudes
4. Parser rejects malformed lines with a clear error message

## Manual test checklist
1. Paste 7 lines, verify first is 0 and last is 1000
2. Remove a parenthesis, parsing still works
3. Add an invalid line, error shown and no partial silent import
