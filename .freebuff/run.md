# WorkPulse Dev Server

## Prerequisites

- Node.js 18+ installed
- Dependencies installed: `npm install`
- `.env` file present at project root (already exists in main checkout)

## Reproduce uncommitted artifacts

The `.env` file is already present in the main checkout. No additional copies needed since this workspace IS the main checkout.

## Run the server

```bash
npm run dev
```

The dev server starts on port 3000 by default, or picks the next available port if 3000 is in use. In this session, the server is running at `http://localhost:57516`.

## Existing server

- **PID**: 20776
- **Port**: 57516
- **URL**: http://localhost:57516
- **Log**: `.next/dev/logs/next-development.log`

To stop: `taskkill /PID 20776 /F`
