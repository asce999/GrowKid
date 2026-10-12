# GrowKid

**A Gamified Parental Task Platform — The Positive Alternative to Harmful Online Challenge Games**

GrowKid is a full-stack gamified task management platform designed to foster positive development in children. By turning everyday chores, educational goals, and behavioral milestones into engaging quests, GrowKid provides a healthy alternative to negative online influences.

## 📌 Status

The frontend is complete: all 19 pages exist. A visitor can read what GrowKid is on the landing page and what it keeps safe on the Safety and privacy page, and sign up. The core loop works end to end. A parent signs up, adds a child and creates a task. The child sends proof. The parent approves it or sends it back with a note. An approval awards XP towards the child's next level, counts towards a streak and can earn a sticker; the child sees the reward on their home page and can look back at everything earned. The parent can follow a child's progress week by week and print it as a report, change their own name and password, and delete the family's data. Anyone signed in can report a problem, and a moderator reads and answers each report.

There is no backend yet. The client runs against a stand-in for the server that keeps its data in the browser (`client/src/api/fake.js`), so nothing is shared between devices and nothing is secured. `server/` holds the scaffold only.

Still to build: the backend, integration and deployment. The report is printed by the browser for now; a PDF built by the server comes with the backend.

## 🚀 Tech Stack

**Frontend (in use):**
- React 19 (Vite)
- Tailwind CSS v4
- React Router 7
- Zustand (State Management)
- Lucide (Icons)

**Backend (planned; dependencies installed, no code yet):**
- Node.js & Express.js
- PostgreSQL
- Prisma (ORM)
- JSON Web Tokens (JWT) & bcryptjs
- Multer (File Uploads)
- Axios, to connect the client to the API

## 📁 Project Structure

This is a monorepo containing both the frontend client and the backend server.

```
GrowKid/
├── client/                 # React frontend application
│   └── src/
│       ├── api/            # The API contract, and the in-browser stand-in for the server
│       ├── components/     # Shells, task cards, proof, review, shared states
│       ├── hooks/          # Data loading helpers
│       ├── pages/          # One file per page
│       ├── store/          # Session state (Zustand)
│       ├── utils/          # Task rules, formatting, messages
│       ├── router.jsx      # Routes and role guards
│       └── index.css       # Design tokens and base styles
│
├── server/                 # Express backend (scaffold only)
│   └── prisma/             # Database schema (no models yet)
│
└── Documentation/          # Synopsis, poster, design reference, sitemap, milestone reports
```

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v20 or higher)
- [Git](https://git-scm.com/)

[PostgreSQL](https://www.postgresql.org/) will be needed once the backend is built.

## ⚙️ Running the Frontend

```bash
git clone https://github.com/asce999/GrowKid.git
cd GrowKid/client
npm install
npm run dev
```

Open the address Vite prints. In development the sign-in page lists demo accounts for a parent, two children and a moderator.

Other commands, run inside `client/`:

| Command | What it does |
|---|---|
| `npm run build` | Builds the production bundle |
| `npm run lint` | Lints the code with Oxlint |
| `npm run check` | Checks the task rules |

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
