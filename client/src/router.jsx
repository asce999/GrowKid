import { createBrowserRouter } from 'react-router-dom'
import { Crashed, FirstChildProgress, RequireRole, Root, SignedOutOnly } from './components/Guards.jsx'
import { ChildShell, ModeratorShell, ParentShell, PublicShell, RoleShell } from './components/Shells.jsx'
import ChildForm from './pages/ChildForm.jsx'
import ChildTask from './pages/ChildTask.jsx'
import Family from './pages/Family.jsx'
import Growth from './pages/Growth.jsx'
import Landing from './pages/Landing.jsx'
import NotFound from './pages/NotFound.jsx'
import Overview from './pages/Overview.jsx'
import Privacy from './pages/Privacy.jsx'
import Progress from './pages/Progress.jsx'
import Report from './pages/Report.jsx'
import ParentRewards from './pages/ParentRewards.jsx'
import Reports from './pages/Reports.jsx'
import Rewards from './pages/Rewards.jsx'
import Settings from './pages/Settings.jsx'
import SignIn from './pages/SignIn.jsx'
import SignUp from './pages/SignUp.jsx'
import Stickers from './pages/Stickers.jsx'
import TaskDetail from './pages/TaskDetail.jsx'
import TaskForm from './pages/TaskForm.jsx'
import Tasks from './pages/Tasks.jsx'
import Today from './pages/Today.jsx'

// All 23 routes of Documentation/FRONTEND-SITEMAP.md section 3.

const alone = (path, shell, page) => ({ path, element: shell, children: [{ index: true, element: page }] })

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <Crashed />,
    children: [
      {
        element: <SignedOutOnly />,
        children: [
          alone('/', <PublicShell />, <Landing />),
          { path: '/login', element: <SignIn /> },
          { path: '/signup', element: <SignUp /> },
        ],
      },
      alone('/privacy', <PublicShell />, <Privacy />),
      {
        path: '/parent',
        element: (
          <RequireRole role="parent">
            <ParentShell />
          </RequireRole>
        ),
        children: [
          { index: true, element: <Overview /> },
          { path: 'tasks', element: <Tasks /> },
          { path: 'tasks/new', element: <TaskForm /> },
          { path: 'tasks/:taskId', element: <TaskDetail /> },
          { path: 'tasks/:taskId/edit', element: <TaskForm /> },
          { path: 'rewards', element: <ParentRewards /> },
          { path: 'progress', element: <FirstChildProgress /> },
          { path: 'progress/:childId', element: <Progress /> },
          { path: 'family', element: <Family /> },
          { path: 'family/new', element: <ChildForm /> },
          { path: 'family/:childId', element: <ChildForm /> },
          { path: 'settings', element: <Settings /> },
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
          { index: true, element: <Today /> },
          { path: 'tasks/:taskId', element: <ChildTask /> },
          { path: 'growth', element: <Growth /> },
          { path: 'stickers', element: <Stickers /> },
          { path: 'rewards', element: <Rewards /> },
          { path: '*', element: <NotFound /> },
        ],
      },
      alone(
        '/admin/reports',
        <RequireRole role="moderator">
          <ModeratorShell />
        </RequireRole>,
        <Reports />,
      ),
      alone(
        '/report',
        <RequireRole>
          <RoleShell />
        </RequireRole>,
        <Report />,
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
