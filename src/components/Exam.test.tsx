import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatClock } from './Exam'
import { EXAM_MS, buildPaper } from '../exam/paper'
import { getItem } from '../content/loader'
import { tr } from '../i18n/strings'
import type { UIKey } from '../i18n/strings'
import type { ChoiceItem } from '../content/types'

// The mock paper. What is worth testing is everything that makes it an EXAM
// rather than a practice session: nothing is marked until it is handed in,
// answers stay revisable, and the clock is real.

const saveExamRun = vi.fn()
vi.mock('../db/data', () => ({
  saveExamRun: (...a: unknown[]) => {
    saveExamRun(...a)
    return Promise.resolve(1)
  },
}))

// `t` is swappable so the placeholder tests can render the REAL strings. With
// the identity mock everywhere, "{n}" never reaches the DOM and a missing
// substitution is invisible — which is exactly what happened.
let translate: (k: string) => string = (k) => k
vi.mock('../app/KiraContext', () => ({
  useKira: () => ({ locale: 'en', t: (k: string) => translate(k) }),
}))
vi.mock('./LocaleToggle', () => ({ LocaleToggle: () => null }))

const { Exam } = await import('./Exam')

async function startPaper() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<Exam onExit={() => {}} />)
  await user.click(screen.getByText('mockExamStart'))
  return user
}

const realStrings = () => {
  translate = (k) => tr(k as UIKey, 'en')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  translate = (k) => k
})
afterEach(() => {
  vi.useRealTimers()
})

describe('formatClock', () => {
  it('reads mm:ss', () => {
    expect(formatClock(75 * 60_000)).toBe('75:00')
    expect(formatClock(61_000)).toBe('1:01')
    expect(formatClock(9_000)).toBe('0:09')
  })

  it('never shows a negative clock', () => {
    // The timer keeps running for the tick that discovers time is up.
    expect(formatClock(-5_000)).toBe('0:00')
  })
})

describe('the intro', () => {
  it('never leaves a {n} placeholder on screen', async () => {
    // Shipped with one: the rules list rendered "Anda ada {n} minit". Unit
    // tests all passed because none of them read the intro — a browser check
    // found it. Every screen of this feature now gets scanned.
    realStrings()
    render(<Exam onExit={() => {}} />)
    expect(document.body.textContent ?? '').toContain('75 minutes')
    expect(document.body.textContent ?? '').not.toMatch(/\{[a-z]\}/i)
  })

  it('reads in BM too, with the count substituted', () => {
    translate = (k) => tr(k as UIKey, 'ms')
    render(<Exam onExit={() => {}} />)
    expect(document.body.textContent ?? '').toContain('75 minit')
    expect(document.body.textContent ?? '').not.toMatch(/\{[a-z]\}/i)
  })
})

describe('sitting the paper', () => {
  it('starts on question 1 of 40 with the full clock, no placeholders', async () => {
    await startPaper()
    expect(document.body.textContent ?? '').not.toMatch(/\{[a-z]\}/i)
    expect(screen.getByText('1/40')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('75:00')
  })

  it('marks NOTHING while the paper is being sat', async () => {
    // The whole point of a mock. Answering must not reveal anything — no
    // correct/wrong styling, no explanation, no feedback card.
    const user = await startPaper()
    const paper = buildPaper(0)
    void paper
    const options = screen.getAllByRole('button', { pressed: false })
    await user.click(options[0])

    expect(screen.queryByText('correctLabel')).not.toBeInTheDocument()
    expect(screen.queryByText('theAnswer')).not.toBeInTheDocument()
    // the chosen option is shown as chosen, not as right or wrong
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('lets an answer be changed, and cleared', async () => {
    // A real paper lets you rub an answer out. Choice items commit on tap in
    // practice; here they must not.
    const user = await startPaper()
    const opts = () => screen.getAllByRole('button', { pressed: false })

    await user.click(opts()[0])
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)

    // a different option replaces it
    await user.click(opts()[0])
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)

    // tapping the chosen one again clears it
    await user.click(screen.getAllByRole('button', { pressed: true })[0])
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  it('remembers answers when moving back and forward', async () => {
    const user = await startPaper()
    await user.click(screen.getAllByRole('button', { pressed: false })[0])
    await user.click(screen.getByText('nextQuestion'))
    expect(screen.getByText('2/40')).toBeInTheDocument()

    await user.click(screen.getByText('previous'))
    expect(screen.getByText('1/40')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('cannot go back from the first question', async () => {
    await startPaper()
    expect(screen.getByText('previous').closest('button')).toBeDisabled()
  })

  it('warns about blanks before handing in', async () => {
    const user = await startPaper()
    // jump to the end without answering
    for (let i = 0; i < 39; i++) await user.click(screen.getByText('nextQuestion'))
    await user.click(screen.getByText('handIn'))
    expect(screen.getByText(/handInBlanks/)).toBeInTheDocument()
  })
})

describe('the clock', () => {
  it('hands the paper in by itself when time runs out', async () => {
    // Nobody is watching to stop them, so the paper has to stop itself.
    await startPaper()
    await act(async () => {
      vi.advanceTimersByTime(EXAM_MS + 2000)
    })
    await waitFor(() => expect(screen.getByText('mockExamResult')).toBeInTheDocument())
    expect(saveExamRun).toHaveBeenCalledTimes(1)
    expect(saveExamRun.mock.calls[0][0].autoSubmitted).toBe(true)
  })

  it('hands in ONCE however many times the button is pressed', async () => {
    // Two saves would mean two exam runs and two sets of attempts against the
    // same 40 items. Note this passes with the saved-once flag removed —
    // handing in unmounts the dialog before a second tap can land — so this
    // pins the BEHAVIOUR, not that particular guard.
    const user = await startPaper()
    for (let i = 0; i < 39; i++) await user.click(screen.getByText('nextQuestion'))
    await user.click(screen.getByText('handIn'))
    const confirm = screen.getAllByRole('button', { name: 'handIn' })
    const btn = confirm[confirm.length - 1]
    await user.dblClick(btn)

    await waitFor(() => expect(saveExamRun).toHaveBeenCalled())
    expect(saveExamRun).toHaveBeenCalledTimes(1)
  })
})

describe('the result', () => {
  it('scores the paper and never records a blank as an attempt', async () => {
    // A blank is a fact about the clock, not about whether she knows the item.
    // Recording it would drop that item to box 1 for the wrong reason.
    const user = await startPaper()
    const paper = buildPaper(0)
    void paper

    await user.click(screen.getAllByRole('button', { pressed: false })[0])
    for (let i = 0; i < 39; i++) await user.click(screen.getByText('nextQuestion'))
    await user.click(screen.getByText('handIn'))
    // the dialog has a heading AND a button reading handIn — take the button
    const confirm = screen.getAllByRole('button', { name: 'handIn' })
    await user.click(confirm[confirm.length - 1])

    await waitFor(() => expect(saveExamRun).toHaveBeenCalled())
    const [run, graded] = saveExamRun.mock.calls[0]
    expect(run.total).toBe(40)
    expect(run.autoSubmitted).toBe(false)
    expect(run.answers.filter((a: string | null) => a !== null)).toHaveLength(1)
    // graded carries all 40; data.ts is what skips the blanks when recording
    expect(graded).toHaveLength(40)
    expect(graded.filter((g: { chosen: string | null }) => g.chosen !== null)).toHaveLength(1)
  })

  it('shows the score, the blanks and a topic breakdown', async () => {
    const user = await startPaper()
    for (let i = 0; i < 39; i++) await user.click(screen.getByText('nextQuestion'))
    await user.click(screen.getByText('handIn'))
    // the dialog has a heading AND a button reading handIn — take the button
    const confirm = screen.getAllByRole('button', { name: 'handIn' })
    await user.click(confirm[confirm.length - 1])

    await waitFor(() => expect(screen.getByText('mockExamResult')).toBeInTheDocument())
    expect(screen.getByText('0')).toBeInTheDocument() // score
    expect(screen.getByText(/leftBlank/)).toBeInTheDocument()
    expect(screen.getByText('byTopic')).toBeInTheDocument()
    expect(screen.getByText('everyQuestion')).toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toMatch(/\{[a-z]\}/i)
  })

  it('reveals the answer and the explanation only in the review', async () => {
    const user = await startPaper()
    for (let i = 0; i < 39; i++) await user.click(screen.getByText('nextQuestion'))
    await user.click(screen.getByText('handIn'))
    // the dialog has a heading AND a button reading handIn — take the button
    const confirm = screen.getAllByRole('button', { name: 'handIn' })
    await user.click(confirm[confirm.length - 1])
    await waitFor(() => expect(screen.getByText('mockExamResult')).toBeInTheDocument())

    const first = buildPaper(
      Number((saveExamRun.mock.calls[0][0] as { seed: number }).seed),
    )[0]
    const item = getItem(first.itemId) as ChoiceItem
    // collapsed: the question is listed, the explanation is not
    expect(screen.queryByText(item.explanation.en)).not.toBeInTheDocument()

    await user.click(screen.getByText(item.prompt.en))
    expect(screen.getByText(item.explanation.en)).toBeInTheDocument()
  })
})
