# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/97a5c0cc-8041-4f4a-8505-060c65d4b12b

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/97a5c0cc-8041-4f4a-8505-060c65d4b12b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/97a5c0cc-8041-4f4a-8505-060c65d4b12b) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Optional: FastAPI Receipt Processor

This repo includes an optional FastAPI backend that validates receipts with Gemini and uploads the image to Supabase Storage only if valid.

Backend setup
- Create `server/.env` with:
  - `SUPABASE_URL=your-supabase-url`
  - `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`
  - `BUCKET_NAME=your-bucket-name`
  - `GEMINI_API_KEY=your-gemini-api-key`
  - `CORS_ORIGIN=http://localhost:5173`
- Install and run:
  - `pip install -r server/requirements.txt`
  - `uvicorn server.main:app --reload --port 8000`

Frontend setup
- Add to `.env.local`:
  - `VITE_API_BASE=http://localhost:8000`
- Restart `npm run dev`.

Flow
- In Chat, pick an image and add instructions, then click Send.
- The frontend calls `POST /process-receipt` with the image and instruction.
- The server parses and validates the receipt. If valid, it uploads to Supabase and returns the URL. If invalid, it responds 400 with a reason.

Notes
- Uploads use the service role, so Storage RLS is bypassed for writes. For public URLs, make the bucket public, or adjust the server to return signed URLs.
