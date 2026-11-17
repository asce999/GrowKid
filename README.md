# GrowKid

**A Gamified Parental Task Platform — The Positive Alternative to Harmful Online Challenge Games**

GrowKid is a full-stack gamified task management platform designed to foster positive development in children. By turning everyday chores, educational goals, and behavioral milestones into engaging quests, GrowKid provides a healthy alternative to negative online influences.

## 📌 Status

The frontend and the backend are built and run together: all 19 pages exist, and the client talks to a real server and a PostgreSQL database. A visitor can read what GrowKid is on the landing page and what it keeps safe on the Safety and privacy page, and sign up. The core loop works end to end. A parent signs up, adds a child and creates a task. The child sends proof. The parent approves it or sends it back with a note. An approval awards XP towards the child's next level, counts towards a streak and can earn a sticker; the child sees the reward on their home page and can look back at everything earned. The parent can follow a child's progress week by week and print it as a report, change their own name and password, and delete the family's data. Anyone signed in can report a problem, and a moderator reads and answers each report.

The server (`server/`) keeps accounts, tasks, proof files, scores and reports. Passwords are hashed, a session is a cookie that lasts seven days, proof files are stored on the server's disk without their location, and a family's day follows the country its parent chose. The report is the browser's print window on Progress: the server builds no PDF.

GrowKid is not hosted anywhere: the client and the server run together on one computer, which is all this project needs. What is still to build is listed in `final-plan.md`.

## 🚀 Tech Stack

**Frontend (in use):**
- React 19 (Vite)
- Tailwind CSS v4
- React Router 7
- Zustand (State Management)
- Lucide (Icons)
- Axios, to call the server's API

**Backend (in use):**
- Node.js & Express.js
- PostgreSQL
- Prisma (ORM)
- JSON Web Tokens (JWT) & bcryptjs
- Multer (File Uploads)
- Helmet and express-rate-limit

## 📁 Project Structure

This is a monorepo containing both the frontend client and the backend server.

```
GrowKid/
├── client/                 # React frontend application
│   └── src/
│       ├── api/            # The API contract: one function per call to the server
│       ├── components/     # Shells, task cards, proof, review, shared states
│       ├── hooks/          # Data loading helpers
│       ├── pages/          # One file per page
│       ├── store/          # Session state (Zustand)
│       ├── utils/          # Task rules, formatting, messages
│       ├── router.jsx      # Routes and role guards
│       └── index.css       # Design tokens and base styles
│
├── server/                 # Express backend
│   ├── prisma/             # Database schema, migrations and the demo seed
│   ├── scripts/            # The moderator account and pause-family scripts, and the test-database guard
│   ├── src/                # The app, its routes, the award rules and the proof-file handling
│   └── test/               # The tests, run against a real PostgreSQL test database
│
└── Documentation/          # Synopsis, poster, design reference, sitemap, milestone reports
```

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v22 or higher)
- [Git](https://git-scm.com/)
- [PostgreSQL](https://www.postgresql.org/)

## ⚙️ Running GrowKid

**1. The databases.** Create two empty PostgreSQL databases, for example `growkid` for development and `growkid_test` for the tests. Create `growkid_test` once: the tests refuse any database whose name does not end in `_test`, and never reset it.

**2. The server.** In `server/`, copy `.env.example` to `.env` and to `.env.test`, and fill in each one: `NODE_ENV` (`development` in `.env`, `test` in `.env.test`), `DATABASE_URL` (a different database in each), `JWT_SECRET` (at least 32 characters) and `UPLOAD_DIR` (an absolute folder outside the repo, a different one in each). Both files are git-ignored. Then:

```bash
git clone https://github.com/asce999/GrowKid.git
cd GrowKid/server
npm install
npx prisma migrate dev    # creates the tables in the development database
npm run seed              # the demo family, once
npm run dev               # listens on 127.0.0.1:3000
```

**3. The client.** In another terminal:

```bash
cd GrowKid/client
npm install
npm run dev
```

Open the address Vite prints; it sends `/api` to the server. To try it on a phone on the same Wi-Fi (the real-device checks), run `npm run dev:lan` in `client/` instead and open the network address it prints; the server stays on this computer, reached through Vite. Use it only on a network you trust, and only for as long as the demo lasts: anyone on that network can reach the app while it runs. In development the sign-in page lists the demo accounts for a parent and two children. `npm run moderator` in `server/` makes a moderator account of your own from `MODERATOR_EMAIL` and `MODERATOR_PASSWORD` set in the shell; the password needs at least 20 characters. A moderator signs in with a second step, a 6-digit code from an authenticator app: the script prints an `otpauth://` link once, on its second line, and that link (or the secret in it) goes into the app as a time-based key (SHA-1, 6 digits, 30 seconds). It is not shown again. `MODERATOR_TOTP=new` makes a new secret and prints a new link; `MODERATOR_REMOVE=1` removes the moderator with that address. The seeded demo moderator has no secret, so it cannot sign in until you enrol it once: `MODERATOR_EMAIL=moderator@example.com`, a new `MODERATOR_PASSWORD` of 20 or more characters and `MODERATOR_TOTP=new`. If a report shows a child may not be safe, a moderator can pause the sender's family from Reports, or `REPORT_ID=<the report's id> ACTION=pause npm run pause-family` in `server/` does the same: it signs the sender's whole family out and stops them signing in, and keeps everything of theirs as it is; `ACTION=unpause` undoes it. Every answer, pause and unpause a moderator makes is recorded (which moderator, which report, what and when; no words or names), and nothing in the app changes that record. Read it with SQL: `SELECT * FROM "ModeratorAction" ORDER BY at;`.

**4. The demo.** A demo runs the built app, not the development one. Start the server with `npm start` in `server/`, then in `client/` run `npm run build` and `npm run preview`, and open the address it prints. In this mode every page carries a Content-Security-Policy that lets the browser load only GrowKid's own files, and the development switches and the demo sign-in list are not in the build.

**Every check in one command.** From the repository's root, `npm run verify` runs the server's lint and tests, the client's lint, checks and build, the end-to-end test of the whole loop, and the two data-boundary checks, and prints one line for each. `npm run verify:quick` leaves out the server tests and the end-to-end test.

The end-to-end test (`npm run e2e` in `client/`, after `npx playwright install chromium` once) signs up a throwaway family in the built app, takes one task from creation to a given reward, checks every page it visits for accessibility problems, and deletes the family. It uses the development database and starts the server and the built client itself when they are not already running.

Commands, run inside `client/`:

| Command | What it does |
|---|---|
| `npm run build` | Builds the production bundle |
| `npm run lint` | Lints the code with Oxlint |
| `npm run check` | Checks the task rules |

Commands, run inside `server/`:

| Command | What it does |
|---|---|
| `npm test` | Migrates the test database, then runs every test against it |
| `npm run lint` | Lints the code with Oxlint |
| `npm run seed` | Creates the demo family (development only, refuses a second run) |

## 🔒 Known advisories

`npm audit` is clean in `client/`. In `server/` it reports 3 high-severity advisories, all in the configuration loader of Prisma's command-line tool (`prisma`, a development dependency). That tool runs only when a developer types a `prisma` command; nothing in it handles a request, and `@prisma/client`, which does, is not affected. The fix is Prisma 7, and this project stays on Prisma 6. The advisories are accepted on those grounds (15 November 2026).

## 🔑 Common passwords

`server/src/common-passwords.txt` is the first 1,000 lines of `Passwords/Common-Credentials/10k-most-common.txt` from [SecLists](https://github.com/danielmiessler/SecLists) (MIT licence). The server refuses a new password that is on it.

## 📚 Documentation

Everything is in `Documentation/`:

- `GrowKid-Synopsis.pdf` and `growkid-poster.jpg`: the accepted synopsis and poster
- `DESIGN.md`: the design reference (colour, type, components, rules)
- `FRONTEND-SITEMAP.md`: the pages, the routes and the rules the backend must honour
- `GrowKid-Milestone-*.docx`: one report per milestone
- `GrowKid-Process-Documentation.docx`: the development process up to 8 October 2026
- `figures/`: the screenshots and diagrams used in the reports

## 👥 Contributors
- **Aryan D'cruz** (@asce999)
- **Vedant Bane** (@vedantbane3112)
- **Rajat Madan** (@rajatmadan2007-spec)
- **Nidhi Machhi** (@Nidhi011007)

---
*Developed as part of the SY2615 Project Group — MIT-ADT UNIVERSITY, PUNE*
