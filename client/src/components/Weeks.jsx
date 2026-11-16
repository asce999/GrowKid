const dayMonth = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
const tasksText = (n) => (n === 1 ? '1 task' : `${n} tasks`)

/** Tasks approved in each of the last six weeks (rule 14; K4 on Growth). who and whose name the child: "Diya" and "Diya’s", or "you" and "yours". Every bar carries its number, so nothing rests on colour. */
export default function Weeks({ weeks, who, whose, title = 'Tasks approved each week' }) {
  const most = Math.max(1, ...weeks.map((week) => week.tasks))
  const total = weeks.reduce((n, week) => n + week.tasks, 0)
  const best = weeks.reduce((a, b) => (b.tasks > a.tasks ? b : a))
  return (
    <section aria-labelledby="weeks-title">
      <h2 id="weeks-title" className="type-subheading">
        {title}
      </h2>
      <p className="muted mt-1 max-w-prose">
        {total === 0
          ? `No task of ${whose} was approved in the last six weeks.`
          : `${tasksText(total)} approved in the last six weeks. The most in one week was ${best.tasks}, in the week of ${dayMonth.format(new Date(best.start))}.`}
      </p>
      <ol className="bars mt-6">
        {weeks.map((week, i) => (
          <li key={week.start}>
            <span className="bar-well" aria-hidden="true">
              <span className={`type-data ${week.tasks === 0 ? 'muted' : ''}`}>{week.tasks}</span>
              <span className="bar" style={{ '--part': week.tasks / most }} />
            </span>
            <span className="type-small mt-2 block font-medium" aria-hidden="true">
              {/* narrow on a phone, so every label breaks into two short lines alike */}
              <span className="max-sm:mx-auto max-sm:block max-sm:w-10">{i === weeks.length - 1 ? 'This week' : dayMonth.format(new Date(week.start))}</span>
            </span>
            <span className="type-small muted block tabular-nums" aria-hidden="true">
              {week.xp} XP
            </span>
            <span className="sr-only">
              Week of {dayMonth.format(new Date(week.start))}: {tasksText(week.tasks)} approved, {week.xp} XP earned.
            </span>
          </li>
        ))}
      </ol>
      <p className="type-small muted mt-3 max-w-prose">
        Each bar is one week, Monday to Sunday, named by its Monday. A task is counted in the week {who} sent the
        proof that was approved.
      </p>
    </section>
  )
}
