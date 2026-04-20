# Frontend and Backend Overview

## Frontend (Client)

These files run in the browser and render the UI:

- `src/App.tsx`: Main React interface, feature sections, filters, forms, and API requests.
- `src/App.css`: Component and layout styling for the dashboard.
- `src/main.tsx`: React entry point and app bootstrap.
- `src/index.css`: Global base styles.
- `index.html`: HTML host page for the React app.
- `vite.config.ts`: Frontend tooling config and API proxy setup.

## Backend (Server)

These files run on Node.js and provide API endpoints:

- `server/index.js`: Express server with routes and request handling.
- `server/data.js`: In-memory data store used by the API.

## API Endpoints Used By Frontend

- `GET /api/health`: Health check endpoint.
- `GET /api/dashboard`: Returns dashboard data (transactions, budgets, pots, bills).
- `POST /api/transactions`: Adds a new transaction.
- `POST /api/pots/:name/move`: Updates a pot (add/withdraw behavior).

## How Frontend and Backend Connect

- Frontend sends requests to `/api/...` from `src/App.tsx`.
- Vite proxy in `vite.config.ts` forwards `/api` traffic to `http://localhost:4000` during development.

## Run Commands

- `npm run dev:client`: Start frontend only.
- `npm run dev:server`: Start backend only.
- `npm run dev:full`: Start both frontend and backend together.
