# User Manual

## 1. Getting started

1. Open <https://she.ecg.com.gh> on your phone, tablet or laptop.
2. Sign in with your ECG email and password.
3. Optionally enrol Multi-Factor Authentication (Profile → Security → Enable MFA).
4. Tap **Add to Home Screen** when your browser offers it — the app installs as a Progressive Web App and works offline.

## 2. Navigation

The left rail lists every module you have access to. Your role determines what you see:

| Role | Sees |
| ---- | ---- |
| District staff | Their own district's incidents, hazards, inspections, etc., plus reports they filed elsewhere |
| Regional staff | Their region's records, plus reports they filed elsewhere |
| Head Office staff | Only the reports they filed — they pick the region and district like other staff |
| Head Office safety officer | Every region and district |
| Head Office SHE | Every region and district — same as Head Office safety officer |
| Sys Admin     | Everything + administration tools |

## 3. Reporting an incident

Follow the six-step reporting workflow:

1. **Immediate response** — at the scene, give first aid if needed, secure the area, call emergency services when required, and inform the supervisor. Tick those checks on **Incidents → Report incident** before you file.
2. **Notification** — file the report (type, severity, title, description, time, GPS, photos). Even with no signal, it is saved locally and synced when you reconnect. The safety officer for that district is notified.
3. **Documentation** — the case is now on the incident record with photos, people counts and location.
4. **Investigation** — assign an investigator, add witness statements, and record findings including the **root cause**.
5. **Corrective and preventive action** — raise at least one CAPA from the incident. If a procedure, JSA or other protocol must change, tick that on the action and record what must be updated. Open **Management** to maintain the ISO registers.
6. **Submit to management** — when the investigator, root cause and a CAPA are on record, tap **Submit to management**. Approvers then close the case. Export the PDF report from the incident page for internal management reporting.

## 4. Hazard reporting & risk matrix

The 5×5 matrix automatically classifies the risk:

| Likelihood × Severity | Risk class |
| --------------------- | ---------- |
| 1 – 4   | LOW |
| 5 – 9   | MEDIUM |
| 10 – 16 | HIGH |
| 17 – 25 | EXTREME |

`HIGH` and `EXTREME` hazards trigger real-time push notifications to the regional SHE team.

## 5. Permit-to-Work

1. Choose the permit type (Electrical, Hot Work, Excavation, Confined Space, Working at Height, Isolation).
2. Capture isolations, hazards, controls and PPE.
3. Both the applicant and issuer sign on the device.
4. The permit becomes **ACTIVE** automatically and **EXPIRED** when its window passes.

## 6. Corrective actions (CAPA)

Open → Assigned → In progress → Verification → Closed.

Overdue items flip to `OVERDUE` automatically and emit notifications.
The verifier closes the action — and only the verifier can.
If the action requires a protocol update, link the controlled document, JSA, hazard, or change record and record what changed before sending it for a check.

## 6a. Management system (ISO)

**Management** holds the ISO 45001 / 14001 registers that the other modules do not already keep: context, policy, scope, interested parties, legal requirements, objectives, aspects, controlled documents, communication, monitoring, change, emergencies, management review, worker consultation, and contractors.

Head Office records policy, scope and context. Safety officers record the rest for their region. Staff can read issued procedures and the published policy. These registers start empty — type in ECG’s real documents. Do not invent them.

## 7. Working offline

A blue banner appears at the top of the app whenever you're offline:

> *Offline mode — captured data will sync automatically.*

Your draft incidents, hazards, inspections, near-miss reports and CAPA progress
updates are saved on-device. The moment connectivity returns, the queue
flushes automatically. A counter in the banner shows how many items are
still pending.

## 8. Notifications

You'll receive in-app, email, SMS and push notifications for:

- Incidents reported in your scope
- Corrective actions due / overdue
- Permits expiring within 24 hours
- Training certificates expiring within 30 days

## 9. Reports

Reports → choose the report type → **Download** (Excel or PDF).
Your report is automatically scoped — district users get district reports,
regional users get regional reports, etc.
