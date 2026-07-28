import { useState } from 'react'
import { useKira } from '../app/KiraContext'
import { AVATARS } from '../app/avatar'
import { MAX_NAME, clean, setAvatar, setName } from '../app/profile'
import { Avatar, BigButton, PlayCard } from './play'
import { FOCUS } from './ui'

/**
 * Name and face, reachable by EVERY learner from the home header.
 *
 * Previously the name field lived inside the classes screen and only rendered
 * once you had joined a class — so a learner practising alone could never be
 * anybody, and one who had already set a name saw an empty box because the
 * field never loaded the current value.
 */
export function ProfileSheet({
  name,
  avatar,
  userId,
  onSaved,
  onClose,
}: {
  name: string | null
  avatar: string | null
  userId: string | null
  onSaved: (p: { name: string | null; avatar: string | null }) => void
  onClose: () => void
}) {
  const { t } = useKira()
  // Pre-filled with what is already set — the whole point of the fix.
  const [draft, setDraft] = useState(name ?? '')
  const [pick, setPick] = useState<string | null>(avatar)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const saved = await setName(draft)
      if (pick) await setAvatar(pick)
      onSaved({ name: saved, avatar: pick })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-5 px-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          {t('editProfile')}
        </h1>
        <button
          onClick={onClose}
          className={`rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 ${FOCUS}`}
        >
          {t('back')}
        </button>
      </header>

      {/* Live preview of exactly what everyone else will see. */}
      <div className="flex flex-col items-center gap-2">
        <Avatar seed={userId} chosen={pick} size="lg" className="animate-pop" />
        <p className="text-base font-bold text-slate-900 dark:text-white">
          {clean(draft) ?? t('yourName')}
        </p>
      </div>

      <PlayCard>
        <label
          htmlFor="kira-name"
          className="text-sm font-bold text-slate-700 dark:text-slate-200"
        >
          {t('yourName')}
        </label>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t('yourNameHint')}
        </p>
        <input
          id="kira-name"
          value={draft}
          maxLength={MAX_NAME}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('yourName')}
          className={`mt-3 min-h-12 w-full rounded-2xl bg-slate-100 px-4 text-base font-semibold ring-1 ring-slate-200 outline-none placeholder:font-normal placeholder:text-slate-400 dark:bg-slate-700/60 dark:text-white dark:ring-slate-600 ${FOCUS}`}
        />
      </PlayCard>

      <PlayCard>
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {t('pickAvatar')}
        </span>
        <div className="mt-3 grid grid-cols-8 gap-2">
          {AVATARS.map((e) => (
            <button
              key={e}
              onClick={() => setPick(e)}
              aria-pressed={pick === e}
              aria-label={e}
              className={`grid aspect-square place-items-center rounded-2xl text-2xl transition ${FOCUS} ${
                pick === e
                  ? 'bg-indigo-100 ring-2 ring-indigo-500 dark:bg-indigo-500/25'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-700'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </PlayCard>

      <BigButton onClick={() => void save()} disabled={busy || clean(draft) === null}>
        {t('save')}
      </BigButton>
    </div>
  )
}
