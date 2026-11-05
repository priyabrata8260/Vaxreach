# VaxReach synthetic data assumptions

`src/data/syntheticChildren.js` generates a deterministic dataset of 120 fictional child records. The records are created locally for the prototype and are not loaded from a service.

## Sample schedule

This intentionally simplified schedule exists only to exercise VaxReach screens and calculations. It is not clinical guidance and does not represent a complete national or local immunisation schedule.

| Sample dose | Scheduled age |
| --- | ---: |
| BCG | Birth (day 0) |
| OPV 1 | 6 weeks (day 42) |
| Pentavalent 1 | 6 weeks (day 42) |
| Pentavalent 2 | 10 weeks (day 70) |
| MR 1 | 9 months (day 270) |

## Date and dose rules

- All age and dose calculations use the fixed prototype reference date **2026-11-05** so charts and summaries stay reproducible.
- Birth dates are generated within the preceding 1,095 days. Display age is calculated from the birth date and reference date, rather than separately randomized.
- Registration dates fall between the birth date and the reference date.
- Each record has a unique `VXR-####` ID. Names are assembled from fictional name lists; localities and ASHA assignments come from sample lists.
- For each dose whose due date has passed, a seeded deterministic probability simulates a vaccination record. Simulated administration dates are on or after the dose due date and never after the reference date.
- A missing dose with a due date **before** the reference date is overdue. Doses due on the reference date or later remain pending. Upcoming counts include pending doses due from the reference date through the next 30 days.
- `completedDoses`, `pendingDoses`, and `overdueDoses` are separate arrays. Their entries are derived from the sample schedule, birth date, and generated vaccination history.
- `migrationStatus` identifies residents and families marked as migrated out. `familyReachability` separately identifies unreachable households. `followUpStatus` applies this precedence: migrated, unreachable, immediate follow-up for overdue doses, scheduled for pending doses, then up to date.

## Dashboard calculations

The dashboard and Child Registry use the same child records from `src/data/syntheticChildren.js`. Fully immunised means all five sample doses have a recorded administration; partially immunised means fewer than five. Coverage is fully immunised children divided by all registered children. Overdue and upcoming statistics count doses. Locality coverage groups those same child records. The monthly trend and recent activity are derived from their vaccination histories. The follow-up list is derived from overdue, migrated, and unreachable records.

New Child Registry records receive the next available `VXR-####` ID and begin with an empty vaccination history. Their pending and overdue doses are calculated from their birth date and the same sample schedule. Editing preserves dose history and recalculates age and dose classifications. Registry changes persist in browser `localStorage` for this prototype, and dashboard summaries are recalculated from the updated records. Clearing this browser's local storage restores the original generated dataset.

The Vaccination Tracker expands each child into one row per scheduled dose. It accepts a dose once per child, checks the actual date is a valid calendar date on or after that dose's scheduled date and no later than the reference date, then updates the same registry record. The prototype grants its local `health_worker` role permission to record doses; this client-side role check is for demonstration and is not production access control.

All names, dates, assignments, histories, and counts are illustrative. Do not use these records for clinical decisions or contact them as real people.
