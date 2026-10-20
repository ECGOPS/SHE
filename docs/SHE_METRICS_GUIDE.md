# SHE Dashboard Metrics Guide

This guide explains the key Safety, Health and Environment (SHE) dashboard metrics used in the ECG SHE Management System.

The purpose of these metrics is to help safety officers, regional managers, head office users and system administrators understand current safety performance, identify trends, and act quickly on high-risk issues.

## 1. Total Incidents

**Meaning:**  
The total number of recorded incidents within the reporting period.

**Example:**  
If one worker injury was reported this year, the dashboard shows:

```text
Total Incidents: 1
```

**How to interpret it:**  
A higher number means more incidents have been formally recorded. It does not always mean safety is worse; it may also mean reporting culture has improved.

## 2. Last 12 Months

**Meaning:**  
The dashboard is showing incidents and trends for the previous 12 months.

**Example:**  
If today is August 2026, the dashboard looks at records from August 2025 to August 2026.

**How to interpret it:**  
This helps compare recent safety performance instead of mixing old historical data with current operations.

## 3. LTIFR

**Full name:**  
Lost Time Injury Frequency Rate.

**Meaning:**  
LTIFR measures how often lost-time injuries occur, standardized per 200,000 working hours.

A lost-time injury is an injury where the affected worker cannot return to work on the next scheduled workday.

**Formula:**

```text
LTIFR = (Number of lost-time injuries x 200,000) / Total hours worked
```

**Example:**  
If ECG records:

```text
Lost-time injuries: 2
Total hours worked: 400,000
```

Then:

```text
LTIFR = (2 x 200,000) / 400,000
LTIFR = 1
```

The dashboard would show:

```text
LTIFR: 1 per 200,000 hrs
```

**If LTIFR is 0:**  
No lost-time injuries were recorded in the period.

## 4. TRIR

**Full name:**  
Total Recordable Incident Rate.

**Meaning:**  
TRIR measures all recordable incidents, standardized per 200,000 working hours.

Recordable incidents may include injuries, medical treatment cases, restricted work cases, lost-time injuries and fatalities.

**Formula:**

```text
TRIR = (Number of recordable incidents x 200,000) / Total hours worked
```

**Example:**  
If ECG records:

```text
Recordable incidents: 4
Total hours worked: 800,000
```

Then:

```text
TRIR = (4 x 200,000) / 800,000
TRIR = 1
```

The dashboard would show:

```text
TRIR: 1 per 200,000 hrs
```

**How to interpret it:**  
TRIR gives management a normalized view of incident frequency. It allows comparison across regions, districts or time periods even when workforce size differs.

## 5. Fatalities

**Meaning:**  
The total number of deaths resulting from work-related incidents.

**Example:**

```text
Fatalities: 0 cumulative
```

This means no fatal incidents have been recorded.

**How to interpret it:**  
Fatalities are the most severe safety outcome and should always trigger immediate investigation, escalation and corrective action.

## 6. Near Misses

**Meaning:**  
The number of reported near-miss events.

A near miss is an event that could have caused injury, damage or environmental harm but did not.

**Example:**  
A technician almost touches an exposed live conductor but stops before contact. No injury occurs, but the event should still be reported.

The dashboard may show:

```text
Near Misses: 3
```

**How to interpret it:**  
Near misses are leading indicators. A strong safety culture usually reports more near misses, because workers are identifying risks before they become incidents.

## 7. Hazard Reports

**Meaning:**  
The number of hazards reported in the system.

A hazard is a source of potential harm.

**Examples:**

- Exposed electrical cable
- Damaged transformer fencing
- Oil leakage near equipment
- Missing PPE
- Unsafe ladder use

The dashboard may show:

```text
Hazard Reports: 5
```

**How to interpret it:**  
Hazard reporting helps ECG prevent incidents. A high number of hazard reports may indicate either higher risk exposure or better reporting behavior.

## 8. Open Corrective Actions

**Meaning:**  
The number of corrective actions that are not yet closed or verified.

Corrective actions are tasks created to fix an issue, prevent recurrence, or reduce risk.

**Example:**  
If an investigation finds that a substation gate is damaged, a corrective action may be created:

```text
Repair substation gate and verify access control.
```

The dashboard may show:

```text
Open Corrective Actions: 4
```

**How to interpret it:**  
Open corrective actions require follow-up. Too many open actions may indicate delays in closing safety gaps.

## 9. Overdue Corrective Actions

**Meaning:**  
The number of corrective actions whose due date has passed but are still not closed.

**Example:**  
If a corrective action was due on July 20 and today is August 4, but it is still open, it is overdue.

The dashboard may show:

```text
0 overdue
```

This means no corrective action has passed its due date.

**How to interpret it:**  
Overdue corrective actions are important because unresolved safety issues may expose workers, contractors, customers or the environment to continued risk.

## 10. Environmental Cases

**Meaning:**  
The number of environmental events or cases recorded.

**Examples:**

- Oil spill
- Chemical leakage
- Transformer fluid release
- Waste handling non-compliance
- Noise, smoke or emissions complaint

The dashboard may show:

```text
Environmental Cases: 0
```

This means no environmental events have been recorded in the period.

## Example Dashboard Interpretation

Example dashboard:

```text
Total Incidents: 1
LTIFR: 0 per 200,000 hrs
TRIR: 1 per 200,000 hrs
Fatalities: 0 cumulative
Near Misses: 0
Hazard Reports: 0
Open Corrective Actions: 0
0 overdue
Environmental Cases: 0
```

Interpretation:

```text
One incident has been recorded.
No lost-time injuries occurred.
The recordable incident rate is 1 per 200,000 work hours.
No fatalities were recorded.
No near misses or hazards have been reported.
There are no open or overdue corrective actions.
No environmental cases have been recorded.
```

## Leading and Lagging Indicators

SHE metrics are usually grouped into two types.

### Lagging Indicators

Lagging indicators measure events that have already happened.

Examples:

- Total incidents
- LTIFR
- TRIR
- Fatalities
- Environmental cases

### Leading Indicators

Leading indicators measure proactive safety activity before harm occurs.

Examples:

- Near miss reports
- Hazard reports
- Inspections completed
- Corrective actions closed on time
- Safety training completion

## Why These Metrics Matter

These metrics help ECG:

- Detect unsafe trends early
- Compare performance across districts and regions
- Prioritize high-risk areas
- Monitor corrective action closure
- Support ISO 45001 and ISO 14001 compliance
- Improve accountability across district, regional and head office levels

## Important Notes

- A low number of near misses or hazards is not always good. It may mean people are not reporting.
- A high number of hazards can be positive if it shows active risk identification.
- LTIFR and TRIR depend on accurate working-hour data.
- Corrective actions should be monitored by due date, risk level and closure quality.
- Fatalities and high-severity incidents should always be escalated immediately.
