# Sites Factory SaaS - Admin Foundation

## Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

## 🔄 Development Features
- **Mock Mode**: If `.env.local` is missing API keys, the app automatically switches to an in-memory database for testing.
- **Client Filters**: The Clients module supports filtering by status (Lead, Active, Paused) and searching by name/email.

## 📦 Deployment
This is a standard Next.js app.
1. Commit changes.
2. Deploy to Vercel/Netlify.
3. Add Environment Variables in the deployment dashboard.

2.  **Environment Variables**
    Copy `.env.example` to `.env.local` and fill in your Firebase details:
    ```bash
    cp .env.example .env.local
    ```
    Get these values from your Firebase Console -> Project Settings -> General -> Your apps -> SDK setup and configuration.

3.  **Firebase Auth**
    - Go to Firebase Console -> Authentication -> Sign-in method.
    - Enable **Email/Password**.
    - Create a test user in the "Users" tab.

4.  **Run Locally**
    The project is configured to run on port 2000.
    ```bash
    npm run dev
    ```
    Open [http://localhost:2000](http://localhost:2000).

## Features
- Next.js App Router + TypeScript + Tailwind CSS
- Firebase Authentication (Email/Password)
- Protected Admin Routes
- Clean & Modern Admin UI

## 🔒 Security Hotfix
This project implements strict security rules to prevent unauthorized access.
1. **Firestore Rules**: Only the Admin UID `5LKD1gmaNmZVgKOZPd5bpl5umMT2` can read/write.
2. **Admin Gate**: The UI blocks access to `/admin` routes if the logged-in user's UID does not match the Admin UID.
3. **Deployment**:
   - Install the Firebase CLI: `npm install -g firebase-tools`
   - Login: `firebase login`
   - Deploy Rules: `firebase deploy --only firestore:rules`

## Architecture & Future Migration to DB-Private
We have refactored the app to use a strict **Data Access Layer (DAL)** pattern in preparation for moving to a backend-only database architecture.

### Current State (Hybrid)
- **DAL:** Located in `src/data/`. All Firestore calls happen here.
- **Validation:** Zod schemas in `src/schemas/` validate all data before writing to Firestore.
- **Client-Side:** The DAL currently runs on the client (using Firebase Client SDK), but is structured to be easily swapped.

### Future Migration Steps
To move to a fully secure, DB-private architecture (where the database is not exposed to the public internet):
1.  **Create API Endpoints:** Create Next.js API routes (e.g., `/api/clients`, `/api/projects`) or Server Actions.
2.  **Move DAL to Server:** Move the logic from `src/data/*` into these API routes/actions.
3.  **Use Admin SDK:** Update the DAL functions to use `firebase-admin` instead of the client SDK.
4.  **Update UI:** Update `src/data/*` functions to call the new API endpoints instead of Firestore directly.
    - *Note:* The UI components themselves won't need to change, as they call the `src/data` functions which act as the interface.
5.  **Lock Down Firestore:** Remove client-side access entirely in `firestore.rules`.
