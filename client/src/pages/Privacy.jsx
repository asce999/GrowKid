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
// C8: the date this page last changed. A parent's consent is recorded against it: server/src/rules.js PRIVACY_VERSION holds the same date.
const UPDATED = '16 November 2026'

export default function Privacy() {
  const signedIn = Boolean(useSession((s) => s.user))
  return (
    <div className="max-w-prose">
      <title>Safety and privacy – GrowKid</title>
      <h1 className="type-headline">Safety and privacy</h1>
      <p className="type-small muted mt-1">Updated {UPDATED}</p>
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
          when, and their score, streak and stickers. Nothing is judged in secret. The one thing a child does not see straight away is
          a sealed surprise a parent puts in a weekly quest. It is about a reward, not about the child, and it opens when the quest is
          complete.
        </p>
        <p>
          There is one difference in timing. When a parent approves a task, the parent’s pages count it at once. The child sees it
          arrive on their Today page first, with the reason, and after that it shows everywhere.
        </p>
      </Part>

      <Part id="task-rules-title" title="What a task may not ask for">
        <p>A task may not ask a child to keep a secret, take a dare, or hide something from their parent.</p>
        <p>
          GrowKid refuses a task whose title or instructions use words such as “secret”, “dare” or “don’t tell”, and it says which word
          it found. It checks every other thing a parent writes for a child in the same way: rewards, a quest’s surprise, a cheer, and
          the note a parent sends proof back with or declines a reward with. It looks for whole words only, in any language. A short
          list of words cannot catch everything, so if a task worries you, a child or a parent can report it from the task’s page.
        </p>
      </Part>

      <Part id="rewards-title" title="Rewards, quests and the family leaderboard">
        <p>
          A parent can add rewards, like choosing the film on Friday, and set a weekly quest. A child spends points on rewards; the
          parent sees every request and answers it. A parent can also mark rest days, which keep a streak safe.
        </p>
        <p>
          If a parent turns on the family leaderboard, each child sees their brothers’ and sisters’ first names and how many tasks
          were approved for each of them this week. Nothing else: not their tasks, proof, points or level. Nobody outside the family
          is ever on it, and it is off unless a parent turns it on.
        </p>
      </Part>

      <Part id="moderator-title" title="What a moderator can and cannot see">
        <p>A moderator reads reports and can do one thing: answer them. A moderator cannot open any family’s pages.</p>
        <p>
          If a report shows that a child may not be safe, the person who runs GrowKid can pause the family that sent it. While a
          family is paused, nobody in it can sign in, and nothing of theirs is deleted or changed: it is kept as it was until a person
          decides what happens next.
        </p>
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
          Everything is stored on the GrowKid server, not on your device: for a parent, a name, an email and a country; for a child, a
          name and a username; and every task, repeating task, proof photo and video, note, score and report. A child can also have a
          reward they are saving for, the tasks they asked for from GrowKid’s list of ideas, and when they agreed to the family
          agreement, and a badge they picked from a colour and one of their stickers, which their family sees beside their name. Their parent sees the suggestions, the agreement and the badge; the goal is the child’s own. Whether the reward moment plays sound is a setting on the child's account. The country decides where each
          day starts and ends.
        </p>
        <p>
          Passwords are hashed before they are saved, which means they are scrambled in a way that cannot be undone, so nobody can read
          one back. Proof files stay on the GrowKid server’s own disk, and only the child and their parent can open them.
          Proof can be a photo or a video. Photos and most phone videos are saved without the place they were taken, the camera’s
          details or the time they were made, and under a plain name such as “photo.jpg”; a photo keeps only which way up it goes. A
          WebM video is kept as sent, and so is the GPS route that some action cameras record alongside the picture. GrowKid no longer
          takes PDF files, because one can carry its author’s details and other pictures; a PDF sent before can still be downloaded.
        </p>
        <p>
          When a parent signs up, and again for each child they add, they tick a box to say they are the child’s parent or guardian
          and agree to what this page describes. GrowKid records when they ticked it and which version of this page they saw. It
          cannot check that the person really is the parent.
        </p>
        <p>
          GrowKid sets no advertising or analytics cookies and has no trackers. It sets one cookie, which keeps you signed in on this
          device for up to 7 days, and signing out removes it. If a parent turns on notifications in Settings, that choice is kept in that
          browser only, and a notification never says a name or what is waiting. A parent can also sign out every other device from Settings, and sign a
          child out everywhere from the child’s page. A password that is very common, or that has the person’s name in it, is not
          accepted, and sign-in pauses for a while after too many wrong tries. It asks no other company for anything: even its typefaces come from
          GrowKid itself.
        </p>
      </Part>

      <Part id="delete-title" title="How to delete it, and what deletion keeps">
        <p>
          A parent can delete everything from Settings, by typing their password. That deletes the parent’s account, every child’s
          sign-in, every task and repeating task, every proof with its file, every score and sticker, and every report the family sent that a
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
