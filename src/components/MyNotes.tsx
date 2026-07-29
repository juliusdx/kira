import { useCallback, useEffect, useState } from 'react'
import { useKira } from '../app/KiraContext'
import { Button, Card, FOCUS } from './ui'
import { listMyNotes, saveItemNote, type StoredNote } from '../sync/notes'
import { getEntry, topicOf, t as tc } from '../content/loader'
import { getIdentity } from '../sync/identity'

// Everything the teacher has written, in one place.
//
// Notes are saved against an ITEM, so they were only ever visible by finding
// the learner who had missed that item and opening it. A teacher who had
// written a dozen had no way to read them back, which made writing the
// thirteenth feel pointless.
//
// Teacher surface, so it stays on ui.tsx and it stays sober.

export function MyNotes({ onBack }: { onBack: () => void }) {
  const { t, locale } = useKira()
  const [notes, setNotes] = useState<StoredNote[] | null>(null)
  const [truncated, setTruncated] = useState(false)

  const load = useCallback(async () => {
    const { notes: rows, truncated: cut } = await listMyNotes()
    setNotes(rows)
    setTruncated(cut)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('myNotes')}</h1>
        <Button variant="ghost" onClick={onBack}>
          {t('back')}
        </Button>
      </header>

      <p className="-mt-2 text-sm text-slate-500 dark:text-slate-400">
        {t('myNotesHint')}
      </p>

      {notes === null && <p className="text-sm text-slate-500">{t('loading')}</p>}
      {notes?.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('noNotes')}</p>
        </Card>
      )}

      {notes?.map((n) => {
        // Content is bundled, so the question this note is about is already
        // here — the row carries only an item id, exactly like a miss does.
        const entry = getEntry(n.itemId)
        const topic = topicOf(n.itemId)
        return (
          <Card key={n.itemId}>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {topic ? tc(topic.title, locale) : n.itemId}
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">
              {entry ? tc(entry.item.prompt, locale) : t('itemMissing')}
            </p>
            <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
              {n.note}
            </p>
            <button
              className={`mt-2 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 ${FOCUS}`}
              onClick={async () => {
                const identity = await getIdentity()
                if (!identity) return
                // Clearing a note IS deleting the row — same path the note box
                // uses, so there is one way for a note to stop existing.
                const result = await saveItemNote(identity.userId, n.itemId, '')
                if (result !== 'failed') await load()
              }}
            >
              {t('noteDeleted')}
            </button>
          </Card>
        )
      })}

      {truncated && (
        <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
          {/* Say it rather than silently showing a slice — the roster bug was
              exactly a truncation nobody was told about. */}
          {t('myNotes')}: {notes?.length}+
        </p>
      )}
    </div>
  )
}
