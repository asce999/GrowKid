import { useState } from 'react'
import { flushSync } from 'react-dom'
import * as api from '../api/index.js'
import { RequestLine, RequestTag } from '../components/Request.jsx'
import { EmptyState, ErrorState, PageLoading, Result } from '../components/states.jsx'
import { Points } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { errorText } from '../utils/messages.js'

// The child's reward shop: what the points they earned can be spent on, and what they have asked
// for. Asking holds the points until a parent answers; spending never lowers the level.

const load = () => Promise.all([api.getGrowth(), api.listRewards(), api.listRequests()])

export default function Rewards() {
  const loaded = useLoad(load, [], { live: true })
  const [confirming, setConfirming] = useState(null) // the reward being asked for, if any
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { tone, text } for the last ask

  // The page is not reloaded after an ask (that would swap it for the skeleton and lose the
  // child's place): the new balance and requests are put in place instead.
  const refresh = () => load().then(loaded.set).catch(noticeExpiry)

  if (loaded.status === 'loading') return <PageLoading rows={3} />
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />
  const [growth, rewards, requests] = loaded.data
  const balance = growth.shown.balance

  async function ask(reward) {
    setBusy(true)
    try {
      const asked = await api.requestReward(reward.id)
      // P12: the request in place, and its points held from the balance on screen, as the server holds them
      loaded.set(([g, list, all]) => [{ ...g, shown: { ...g.shown, balance: g.shown.balance - asked.cost } }, list, [asked, ...all]])
      setResult({ tone: 'success', text: 'Asked. A parent will answer soon.' })
    } catch (error) {
      setResult({ tone: 'danger', text: errorText(noticeExpiry(error)) })
      await refresh() // NOT_ENOUGH means the balance on screen was out of date
    }
    setConfirming(null)
    setBusy(false)
  }

  function cancel(id) {
    flushSync(() => setConfirming(null))
    document.getElementById(`ask-${id}`)?.focus()
  }

  return (
    <>
      <title>Rewards – GrowKid</title>
      <h1>Rewards</h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2">
        <Points value={balance} /> to spend.
      </p>
      <p className="type-small muted mt-1">Spending points never lowers your level.</p>

      <Result result={result} />

      <div className="mt-6">
        {rewards.length === 0 ? (
          <EmptyState title="No rewards yet">When a parent adds rewards, they show up here.</EmptyState>
        ) : (
          <ul className="overflow-hidden rounded-card border bg-white">
            {rewards.map((reward) => (
              <li key={reward.id} className="border-b px-4 py-3 last:border-b-0 sm:px-6">
                {confirming === reward.id ? (
                  <div>
                    <p className="break-words">
                      Ask for <span className="font-medium">{reward.title}</span>? It holds {reward.cost} points until a parent answers.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button type="button" className="btn btn-primary" disabled={busy} autoFocus onClick={() => ask(reward)}>
                        Yes, ask
                      </button>
                      <button type="button" className="btn btn-text" onClick={() => cancel(reward.id)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="min-w-0 flex-1 basis-48 font-medium break-words">{reward.title}</p>
                    <Points value={reward.cost} />
                    {reward.cost <= balance ? (
                      <button type="button" id={`ask-${reward.id}`} className="btn btn-secondary" onClick={() => setConfirming(reward.id)}>
                        Ask for this<span className="sr-only">: {reward.title}</span>
                      </button>
                    ) : (
                      <p className="type-small muted">
                        {reward.cost - balance} more {reward.cost - balance === 1 ? 'point' : 'points'} to go
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {requests.length > 0 && (
        <>
          <h2 className="type-subheading mt-10">Your requests</h2>
          <ul className="mt-3 overflow-hidden rounded-card border bg-white">
            {requests.map((request) => (
              <li key={request.id} className="border-b px-4 py-3 last:border-b-0 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="min-w-0 flex-1 basis-48 font-medium break-words">{request.title}</p>
                  <Points value={request.cost} short />
                  <RequestTag status={request.status} />
                </div>
                <RequestLine request={request} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
