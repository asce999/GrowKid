import * as api from '../api/index.js'
import { ErrorState, PageLoading } from '../components/states.jsx'
import { AddChildFirst } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { Requests } from './rewards/Requests.jsx'
import { RewardList } from './rewards/RewardList.jsx'
import { Quests } from './rewards/Quests.jsx'
// The parent's side of the reward shop: requests to answer, the rewards children can ask for, and
// each child's weekly quest. Nothing here reloads the page after a change (that would lose the
// parent's place): the new figures are put in place instead.

const load = () => Promise.all([api.listChildren(), api.listRewards(), api.listRequests(), api.listGrowth(), api.listTasks()])


export default function ParentRewards() {
  const loaded = useLoad(load, [], { live: true })
  // not loaded.reload: that would swap the page for the skeleton and lose the parent's place
  const refresh = () => load().then(loaded.set).catch(noticeExpiry)

  if (loaded.status === 'loading') return <PageLoading rows={4} />
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />
  const [family, rewards, requests, growth, tasks] = loaded.data

  return (
    <>
      <title>Rewards – GrowKid</title>
      <h1>Rewards</h1>
      <p className="muted mt-2">Your children spend points on these. Spending never lowers their level or the points they have earned.</p>
      {family.length === 0 ? (
        <div className="mt-6">
          <AddChildFirst />
        </div>
      ) : (
        <>
          <Requests requests={requests} growth={growth} refresh={refresh} place={loaded.set} />
          <RewardList rewards={rewards} refresh={refresh} place={loaded.set} />
          <Quests family={family} growth={growth} tasks={tasks} refresh={refresh} />
        </>
      )}
    </>
  )
}
