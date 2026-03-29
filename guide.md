# MediConnect Workspace

## Overview

MediConnect is a full telemedicine platform connecting patients and verified doctors in India. Built as a pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS v4 + Wouter routing + React Query

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (all backend)
│   └── mediconnect/        # React + Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
```

## Key Features

### Doctor Flow
1. **Registration** with NMC verification (name, registration#, year, state council, father name)
2. Auto-verify against `https://www.nmc.org.in/MCIRest/open/getPaginatedData`
3. If NMC match fails → pending for admin manual approval
4. Approval notification by checking verification status
5. After approval: fill specialty (45 specialties list), languages, regions, experience
6. Toggle online/available status when logged in
7. **Patient Records page** (`/doctor/patients`) — see all past patients, send prescriptions with document URL links, order medications, update delivery status with delivery notes

### Patient Flow
1. Sign up with email/password
2. Search doctors by symptom → filter by 45 specialties, online status, language/region
3. Same language/region doctors sorted first
4. View doctor profile → request consultation with symptoms
5. Doctor accepts → patient pays (Stripe if keys set, else sandbox) → video call
6. Receive prescriptions (with document URL links) + medication orders
7. Track medication delivery status with notes in Medical Records page

### Consultation Flow
1. Patient requests → doctor gets notification (polling)
2. Doctor accepts/rejects
3. If accepted: patient sees payment UI (Stripe or sandbox test card)
4. Payment confirmed → roomId generated → both join call
5. Real WebRTC video call (getUserMedia + RTCPeerConnection + DB-polling signaling)
6. Doctor sends prescription (text + optional document URL), medication order
7. Doctor updates medication delivery status with delivery notes
8. Doctor marks consultation as complete

### Specialties (45 supported)
General Physician, Cardiologist, Dermatologist, Pediatrician, Psychiatrist, Neurologist, Oncologist, Gastroenterologist, Pulmonologist, Endocrinologist, Nephrologist, Rheumatologist, Ophthalmologist, ENT Specialist, Urologist, Gynecologist, Obstetrician, and 28 more…

### Payment
- Backend creates Stripe PaymentIntent when `STRIPE_SECRET_KEY` is set
- Falls back to sandbox mode (test card: 4242 4242 4242 4242) when key is not set
- Both modes use confirm endpoint to mark consultation as paid

### Admin Flow
- Dashboard with stats
- Approve/reject pending doctors (manual verification)
- View NMC verification status per doctor

## Default Admin Account
- Email: admin@mediconnect.in
- Password: admin123

## Database Schema

Tables:
- `users` — all users (patient/doctor/admin)
- `sessions` — auth sessions
- `doctors` — doctor profiles + verification
- `patients` — patient profiles
- `consultations` — consultation records
- `prescriptions` — doctor prescriptions
- `medication_orders` — medication delivery tracking
- `webrtc_signals` — WebRTC signaling (polling-based)

## Auth

Session-based auth with cookies (`session_token`). No JWT — server stores sessions in DB.

## API Routes

- `POST /api/auth/register/patient`
- `POST /api/auth/register/doctor` (triggers NMC verification)
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/doctors/profile`
- `PUT /api/doctors/availability`
- `GET /api/doctors/search`
- `GET /api/doctors/:id`
- `GET /api/doctors/notifications`
- `GET /api/patients/profile`
- `PUT /api/patients/profile`
- `GET /api/patients/consultations`
- `GET /api/patients/records`
- `POST /api/consultations/request`
- `PUT /api/consultations/:id/respond`
- `POST /api/consultations/:id/payment`
- `POST /api/consultations/:id/payment/confirm`
- `GET /api/consultations/:id`
- `PUT /api/consultations/:id/complete`
- `POST /api/consultations/:id/prescription`
- `POST /api/consultations/:id/medication`
- `PUT /api/consultations/:id/medication/:medId/status`
- `GET /api/admin/doctors/pending`
- `PUT /api/admin/doctors/:id/approve`
- `PUT /api/admin/doctors/:id/reject`
- `GET /api/admin/stats`
- `POST /api/webrtc/token`
- `POST /api/webrtc/signal/:consultationId`
- `GET /api/webrtc/signal/:consultationId/:role`

## Running Codegen
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Database Migration
```bash
pnpm --filter @workspace/db run push
```
