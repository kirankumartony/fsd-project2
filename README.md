# Personal Finance Manager

This project is a full-stack personal finance manager with a React + TypeScript frontend and an Express backend API.

## Features

- Overview dashboard with balances, income, spending, and cash-flow highlights
- Transaction table with search, category filtering, sorting, and pagination
- Budget cards with visual progress and the latest three transactions per category
- Saving pots with add and withdraw actions against goal amounts
- Recurring bill table with current-month payment status
- Express API for dashboard data, transaction creation, and pot updates
- Responsive layout with keyboard-friendly controls and clear visual hierarchy

## Tech Stack

- React 19
- TypeScript
- Vite
- Node.js + Express
- CSS for layout, interactions, and data visualisation

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start frontend + backend together:

   ```bash
   npm run dev:full
   ```

3. Or start backend and frontend separately:

   ```bash
   npm run dev:server
   npm run dev:client
   ```

4. Build for production:

   ```bash
   npm run build
   ```

## Deploy Backend On Render

1. Create a new Web Service from this repository.
2. Render should use:

   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`

3. Add environment variable:

   - `JWT_SECRET` = any strong random string

4. Deploy and copy your backend URL.

## Deploy Frontend On Vercel

1. Keep frontend build settings as Vite defaults.
2. In `vercel.json`, replace `YOUR-RENDER-BACKEND-URL` with your actual Render backend domain.
3. Redeploy on Vercel.

## Project Structure

- `src/App.tsx` contains UI logic and API integration.
- `src/App.css` contains the custom visual system and responsive layout.
- `src/index.css` provides the global reset.
- `server/index.js` contains the Express API routes.
- `server/data.js` contains the in-memory data store.

## Notes

- Data is currently stored in-memory on the Express server (resets when server restarts).
- The backend can be replaced with a database and authentication later.