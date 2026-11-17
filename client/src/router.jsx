import { createBrowserRouter } from 'react-router-dom'
import { Booting, Crashed, FirstChildProgress, RequireRole, Root, SignedOutOnly } from './components/Guards.jsx'
import { ChildShell, ModeratorShell, ParentShell, PublicShell, RoleShell } from './components/Shells.jsx'
import NotFound from './pages/NotFound.jsx'

/**
 * P5: each page's code is its own file, loaded when the page is first opened (React Router's `lazy`). NotFound stays in the main
 * file: it is tiny and other pages draw it too. A page that fails to load lands on Crashed, which reloads once.
 */
const page = (load) => async () => ({ Component: (await load()).default })
const pages = {
  ChildForm: page(() => import('./pages/ChildForm.jsx')),
  ChildTask: page(() => import('./pages/ChildTask.jsx')),
  Family: page(() => import('./pages/Family.jsx')),
  Forgot: page(() => import('./pages/Forgot.jsx')),
  Growth: page(() => import('./pages/Growth.jsx')),
  Landing: page(() => import('./pages/Landing.jsx')),
  Overview: page(() => import('./pages/Overview.jsx')),
  ParentRewards: page(() => import('./pages/ParentRewards.jsx')),
  Privacy: page(() => import('./pages/Privacy.jsx')),
  Progress: page(() => import('./pages/Progress.jsx')),
  Report: page(() => import('./pages/Report.jsx')),
  Reports: page(() => import('./pages/Reports.jsx')),
  Rewards: page(() => import('./pages/Rewards.jsx')),
  Settings: page(() => import('./pages/Settings.jsx')),
  SignIn: page(() => import('./pages/SignIn.jsx')),
  SignUp: page(() => import('./pages/SignUp.jsx')),
  Stickers: page(() => import('./pages/Stickers.jsx')),
  TaskDetail: page(() => import('./pages/TaskDetail.jsx')),
  TaskForm: page(() => import('./pages/TaskForm.jsx')),
  Tasks: page(() => import('./pages/Tasks.jsx')),
  Today: page(() => import('./pages/Today.jsx')),
}

// All 24 routes of Documentation/FRONTEND-SITEMAP.md section 3.

const alone = (path, shell, lazy) => ({ path, element: shell, children: [{ index: true, lazy }] })

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <Crashed />,
    HydrateFallback: Booting, // while the first page's code arrives
    children: [
      {
        element: <SignedOutOnly />,
        children: [
          alone('/', <PublicShell />, pages.Landing),
          { path: '/login', lazy: pages.SignIn },
          { path: '/signup', lazy: pages.SignUp },
          { path: '/forgot', lazy: pages.Forgot },
        ],
      },
      alone('/privacy', <PublicShell />, pages.Privacy),
      {
        path: '/parent',
        element: (
          <RequireRole role="parent">
            <ParentShell />
          </RequireRole>
        ),
        children: [
          { index: true, lazy: pages.Overview },
          { path: 'tasks', lazy: pages.Tasks },
          { path: 'tasks/new', lazy: pages.TaskForm },
          { path: 'tasks/:taskId', lazy: pages.TaskDetail },
          { path: 'tasks/:taskId/edit', lazy: pages.TaskForm },
          { path: 'rewards', lazy: pages.ParentRewards },
          { path: 'progress', element: <FirstChildProgress /> },
          { path: 'progress/:childId', lazy: pages.Progress },
          { path: 'family', lazy: pages.Family },
          { path: 'family/new', lazy: pages.ChildForm },
          { path: 'family/:childId', lazy: pages.ChildForm },
          { path: 'settings', lazy: pages.Settings },
          { path: '*', element: <NotFound /> },
        ],
      },
      {
        path: '/child',
        element: (
          <RequireRole role="child">
            <ChildShell />
          </RequireRole>
        ),
        children: [
          { index: true, lazy: pages.Today },
          { path: 'tasks/:taskId', lazy: pages.ChildTask },
          { path: 'growth', lazy: pages.Growth },
          { path: 'stickers', lazy: pages.Stickers },
          { path: 'rewards', lazy: pages.Rewards },
          { path: '*', element: <NotFound /> },
        ],
      },
      alone(
        '/admin/reports',
        <RequireRole role="moderator">
          <ModeratorShell />
        </RequireRole>,
        pages.Reports,
      ),
      alone(
        '/report',
        <RequireRole>
          <RoleShell />
        </RequireRole>,
        pages.Report,
      ),
      // The design sheet is the coded reference, not one of the 21 routes. Development builds only.
      ...(import.meta.env.DEV
        ? [
            {
              path: '/design',
              lazy: async () => ({ Component: (await import('./pages/DesignSheet.jsx')).default }),
              hydrateFallbackElement: <></>, // nothing to show while the sheet's code arrives
            },
          ]
        : []),
      { element: <PublicShell />, children: [{ path: '*', element: <NotFound /> }] },
    ],
  },
])
