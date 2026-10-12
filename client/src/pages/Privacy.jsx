import { Link } from 'react-router-dom'
import { useSession } from '../store/session.js'

// Safety and privacy. It is written for a parent deciding whether to trust GrowKid and it has to
// be readable by a child: plain headings, short paragraphs, no accordion. Every sentence is true
// of the app as built (FRONTEND-SITEMAP.md section 12, rules 13 to 16). Where a promise would
// need a server or a person that does not exist yet, it says so instead of making the promise.

function Part({ id, title, children }) {
  return (
    <section className="mt-10 border-t pt-6" aria-labelledby={id}>
      <h2 id={id} className="type-subheading">
        {title}
      </h2>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  )
}

const link = 'font-medium text-navy-800 underline underline-offset-4'

export default function Privacy() {
  const signedIn = Boolean(useSession((s) => s.user))
  return (
    <div className="max-w-prose">
      <title>Safety and privacy – GrowKid</title>
      <h1>Safety and privacy</h1>
      <p className="mt-2">
        This page says who can see what in GrowKid, what is stored and where, and how to delete it. It is written so that a child can
        read it too.
      </p>
      <p className="mt-3">
        GrowKid is still being built. Where something works differently today from how it will later, this page says so.
      </p>

      <Part id="see-title" title="Who can see a child’s tasks and proof">
        <p>
          A parent can see every task, every proof and every note for their own children. A child can see their own, and nothing of
          anyone else’s. Nobody else can see them: not another family, not other children, and not a moderator.
        </p>
        <p>
          A child cannot make an account alone. A parent makes it, and chooses the username and the password. There are no public
          profiles, no chat, and no way to contact anyone outside the family.
        </p>
      </Part>

      <Part id="child-title" title="What a child can see about themselves">
        <p>
          Everything a parent sees about them: the tasks, the proof they sent, the notes a parent wrote, who approved each task and
          when, and their score, streak and stickers. Nothing is judged in secret.
        </p>
        <p>
          There is one difference in timing. When a parent approves a task, the parent’s pages count it at once. The child sees it
          arrive on their Today page first, with the reason, and after that it shows everywhere.
        </p>
      </Part>

      <Part id="moderator-title" title="What a moderator can and cannot see">
        <p>A moderator reads reports and can do one thing: answer them. A moderator cannot open any family’s pages.</p>
        <p className="font-semibold">A moderator can see:</p>
        <ul className="grid list-disc gap-1 pl-5">
          <li>the words of the report</li>
          <li>whether a parent or a child sent it, and when</li>
          <li>
            if it was sent from a task’s page, a copy of that task as the parent wrote it: the title, the instructions, the due time
            and the points
          </li>
          <li>the notes a parent sent proof back with, and how many times proof was sent</li>
        </ul>
        <p className="font-semibold">A moderator cannot see:</p>
        <ul className="grid list-disc gap-1 pl-5">
          <li>a name, an email or a username</li>
          <li>a photo, a video or a file</li>
          <li>a note a child wrote with their proof</li>
          <li>any other task, score or person in the family</li>
        </ul>
      </Part>

      <Part id="reports-title" title="A child’s report is not shown to the parent">
        <p>
          When a child reports a problem, it goes straight to a moderator. A parent is not asked, not told and not shown. A parent’s
          pages never list it or count it. The child reads the moderator’s answer on the Report a problem page.
        </p>
        <p>It works the other way too: a parent’s report is not shown to their children.</p>
      </Part>

      <Part id="stored-title" title="What is stored, and where">
        <p>
          Right now, everything is stored in this browser, on this device: accounts, tasks, proof photos, videos and files, scores
          and reports. There is no GrowKid server yet. Nothing is sent anywhere, and nobody else can read it unless they use this same
          browser.
        </p>
        <p>
          This is a working demonstration, not safe storage. Passwords are kept as they were typed, and anyone who knows how to look
          inside a browser can read everything in it. So do not use a password here that you use anywhere else, and do not use this
          version to keep real family records.
        </p>
        <p>Clearing this browser’s site data erases everything GrowKid holds. There is no other copy.</p>
        <p>
          GrowKid sets no advertising or analytics cookies and has no trackers. The one thing it asks another company for is its
          typefaces: this page loads Lexend and Baloo 2 from Google Fonts, so your browser asks Google’s servers for them.
        </p>
      </Part>

      <Part id="delete-title" title="How to delete it, and what deletion keeps">
        <p>
          A parent can delete everything from Settings, by typing their password. That deletes the parent’s account, every child’s
          sign-in, every task and every proof with its file, every score and sticker, and every report the family sent that a
          moderator has answered. No copy is kept. Removing one child from Family deletes the same things for that child.
        </p>
        <p>
          Deletion keeps one thing: a report that no moderator has answered yet. That is on purpose, so that nobody can make a report
          disappear by deleting an account. The kept report has no account, no id and no link to the family. It holds only its
          words, whether a parent or a child sent it, the time, and a copy of the task as the parent wrote it. If the parent wrote a
          name in the task, that name is in the copy. When a moderator answers the report, it is deleted too, because nobody is
          left to read the answer.
        </p>
      </Part>

      <Part id="report-title" title="How to report a problem">
        <p>
          Choose Report a problem in the account menu, or at the bottom of a task’s page. Write what is wrong in your own words. The
          answer shows on the same page.{' '}
          {signedIn && (
            <Link to="/report" className={link}>
              Report a problem now
            </Link>
          )}
        </p>
        <p>
          A report goes to the moderator’s list. This early version has no staff behind that list yet, so do not rely on it in an
          emergency.
        </p>
        <p>
          If you or someone you know needs help right now, tell a grown-up you trust, or call Childline on{' '}
          <a href="tel:1098" className={link}>
            1098
          </a>
          . It is India’s free helpline for children. Any child, or any adult worried about a child, can call at any time of day or
          night.
        </p>
      </Part>
    </div>
  )
}
