# GrowKid

**A Gamified Parental Task Platform — The Positive Alternative to Harmful Online Challenge Games**

GrowKid is a full-stack gamified task management platform designed to foster positive development in children. By turning everyday chores, educational goals, and behavioral milestones into engaging quests, GrowKid provides a healthy alternative to negative online influences.

## 📌 Status

The frontend and the backend are built and run together: all 19 pages exist, and the client talks to a real server and a PostgreSQL database. A visitor can read what GrowKid is on the landing page and what it keeps safe on the Safety and privacy page, and sign up. The core loop works end to end. A parent signs up, adds a child and creates a task. The child sends proof. The parent approves it or sends it back with a note. An approval awards XP towards the child's next level, counts towards a streak and can earn a sticker; the child sees the reward on their home page and can look back at everything earned. The parent can follow a child's progress week by week and print it as a report, change their own name and password, and delete the family's data. Anyone signed in can report a problem, and a moderator reads and answers each report.

The server (`server/`) keeps accounts, tasks, proof files, scores and reports. Passwords are hashed, a session is a cookie that lasts seven days, proof files are stored on the server's disk without their location, and a family's day follows the country its parent chose. The report is the browser's print window on Progress: the server builds no PDF.

Still to build: deployment to a free Oracle Cloud VM.

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
│   ├── scripts/            # The moderator account script, and the test-database guard
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

Open the address Vite prints; it sends `/api` to the server. In development the sign-in page lists the demo accounts for a parent, two children and a moderator. `npm run moderator` in `server/` makes a moderator account of your own.

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
