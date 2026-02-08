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
