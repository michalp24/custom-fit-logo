# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/cb8d7abc-9af8-47b8-b5ae-1244dd7e39b7

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/cb8d7abc-9af8-47b8-b5ae-1244dd7e39b7) and start prompting.

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

Simply open [Lovable](https://lovable.dev/projects/cb8d7abc-9af8-47b8-b5ae-1244dd7e39b7) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Logo Template boundary

The Logo Template page uses the supplied `src/assets/logo-template.svg` silhouette
and its 1250 × 703 canvas. Initial fitting keeps the complete artwork bounds inside
the shape, including conservative allowance for SVG strokes. Scale is limited to
the fitted size, and nudges stop at the boundary without cropping the artwork.
The guide does not appear in exports. Partner Lockup keeps its separate rectangular
guides, free positioning, and 250% scaling.

## Logo body fitting

Partner lockups use the supplied 1920 × 1080 guides: 480 × 370 for vertical
NVIDIA artwork and 692 × 132 for horizontal artwork. Both logos remain side by side.

On upload, the entire partner logo is fitted to the main rectangle at 100%.
Use the scale slider (1–250%) and position controls to adjust it visually. For
Amazon, enlarge the logo until the lettering fits the main rectangle, then nudge
it so the smile extends below. The pink lines are guides, not clipping boundaries;
manual scaling and nudging are not restricted to the rectangle. No artwork is
cropped to the guide. Exports preserve the adjusted scale and position.

Preview and export share the same renderer. Guides are never exported. Transparent
PNG removes only the canvas background. JPG and PNG with background use the selected
canvas theme. Raster uploads keep their original pixels inside SVG exports; they
are not automatically converted into vector paths. JPG backgrounds are not removed.

## Verification

- `npm run typecheck`
- `npm run lint` (legacy backup components and shared UI components still have warnings)
- `npm run build`
- `npm run test:browser` starts a fresh local Vite server and runs Chrome regressions.
  Requires Playwright and Google Chrome. If Playwright is provided by an external
  runtime, set `PLAYWRIGHT_PATH` to its package directory. `BROWSER_CHANNEL` can
  select another installed Playwright browser channel; `TEST_URL` can target an
  existing development server instead (restart it after source changes to avoid
  hot-reload module instances in these tests).
