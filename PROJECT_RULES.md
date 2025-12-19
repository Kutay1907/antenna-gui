# PROJECT_RULES.md

## 1. Core goal
Extend the existing single page app with two new UI tabs, Results and Parameter Optimization, while keeping the current calculator tab unchanged.

## 2. Architecture
Use a simple Clean Architecture layout with SOLID boundaries.

### 2.1 Layers
1. Presentation layer
   1. Templates, static UI, DOM orchestration, chart rendering
2. Application layer
   1. Use cases, validation, mapping, aggregation, export import
3. Domain layer
   1. Data models, metrics formulas, parsing rules, invariants
4. Infrastructure layer
   1. LocalStorage persistence, file import export adapters

### 2.2 Dependency rule
Dependencies flow inward only.
Presentation depends on Application.
Application depends on Domain.
Infrastructure depends on Domain, is injected into Application.

## 3. File and folder conventions
Use underscore in filenames, never use dash in filenames.

Suggested structure
1. backend
   1. app.py
2. templates
   1. index.html
3. static
   1. css
      1. app.css
   2. js
      1. presentation
         1. tabs_controller.js
         2. results_view.js
         3. optimization_view.js
         4. charts_view.js
      2. application
         1. results_service.js
         2. optimization_service.js
         3. export_import_service.js
      3. domain
         1. models.js
         2. metrics.js
         3. parser.js
         4. validators.js
      4. infrastructure
         1. storage_repository.js
         2. file_adapter.js

## 4. SOLID requirements
1. Single responsibility
   1. One module, one reason to change
2. Open closed
   1. Add new dataset types without rewriting metrics code
3. Liskov substitution
   1. Storage repositories share the same interface
4. Interface segregation
   1. Small repositories, no giant god objects
5. Dependency inversion
   1. Services accept repositories as constructor args

## 5. Data model rules
1. Results has exactly 6 datasets
   1. felt_1_ring
   2. felt_2_ring
   3. felt_3_ring
   4. jeans_1_ring
   5. jeans_2_ring
   6. jeans_3_ring
2. Each dataset stores rows with glucose mg per dL, S11 and S21 freq and amp
3. Optimization runs store params plus an optional parsed pairs list and derived rows list

## 6. Parsing rules for pair input
1. Input is multiple lines
2. Each line contains two floats, frequency and amplitude
3. Parentheses and whitespace are optional
4. Comma separator required
5. Negative amplitudes are allowed
6. First line maps to 0 mg per dL
7. Last line maps to 1000 mg per dL
8. Intermediate glucose values are linearly spaced

## 7. Metrics rules
Compute in a deterministic way, no randomness.
1. Total shift 0 to 1000
2. Total shift 72 to 600 when both endpoints exist, else show not available
3. Sensitivity as MHz per mg per dL using total shift and glucose span
4. Amplitude delta using endpoint values
5. Ranking in optimization by sensitivity descending

## 8. Persistence rules
1. Use LocalStorage as the default persistence
2. Provide JSON export and JSON import for full state
3. Never lose data on tab switch

## 9. Quality gates
1. JavaScript uses modules, no global variables except a single app bootstrap
2. Every public function has JSDoc describing inputs and outputs
3. Validation errors are explicit and user visible
4. No silent failures

## 10. Backend scope
Backend serves templates and static assets only.
No computation required on the server for this project.

## 11. Testing scope
1. Domain parser and metrics have unit style tests in plain JavaScript
2. Manual test checklist exists per stage
3. No heavy test frameworks required, keep it minimal
