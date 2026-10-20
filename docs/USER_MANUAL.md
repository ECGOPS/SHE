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
| District User | Their own district's incidents, hazards, inspections, etc. |
| Regional User | All districts in their region + regional dashboards |
| Global User   | All ECG data + national KPIs |
| Sys Admin     | Everything + administration tools |

## 3. Reporting an incident

1. **Incidents → Report incident**.
2. Choose type and severity (Negligible → Catastrophic).
3. Add a clear title, full description, time and location (auto-fills via GPS).
4. Capture photos / videos directly with your camera.
5. Add witness statements (with optional digital signatures).
6. Tap **Submit** — even with no signal, your report is saved locally and synced as soon as you reconnect.

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
