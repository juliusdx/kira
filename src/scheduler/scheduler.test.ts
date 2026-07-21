import { describe, it, expect } from 'vitest'
import {
  BOX_INTERVALS_MS,
  initialReview,
  intervalForBox,
  isDue,
  masteryWeight,
  MAX_BOX,
  schedule,
} from './scheduler'

const T0 = 1_700_000_000_000 // fixed reference "now"
const DAY = 24 * 60 * 60 * 1000

describe('initialReview', () => {
  it('starts in box 1 and is due immediately', () => {
    const s = initialReview(T0)
    expect(s.box).toBe(1)
    expect(s.dueAt).toBe(T0)
    expect(s.streak).toBe(0)
    expect(s.lastResult).toBeNull()
    expect(isDue(s, T0)).toBe(true)
  })
})

describe('schedule — correct answers climb the boxes', () => {
  it('promotes box and grows the interval', () => {
    let s = schedule(undefined, true, T0) // box 1 -> 2
    expect(s.box).toBe(2)
    expect(s.streak).toBe(1)
    expect(s.dueAt).toBe(T0 + 1 * DAY)

    s = schedule(s, true, T0) // 2 -> 3
    expect(s.box).toBe(3)
    expect(s.dueAt).toBe(T0 + 3 * DAY)

    s = schedule(s, true, T0) // 3 -> 4
    expect(s.dueAt).toBe(T0 + 7 * DAY)

    s = schedule(s, true, T0) // 4 -> 5
    expect(s.box).toBe(5)
    expect(s.dueAt).toBe(T0 + 21 * DAY)
  })

  it('caps at box 5', () => {
    let s = initialReview(T0)
    for (let i = 0; i < 10; i++) s = schedule(s, true, T0)
    expect(s.box).toBe(MAX_BOX)
    expect(s.streak).toBe(10)
  })
})

describe('schedule — wrong answers drop to box 1', () => {
  it('resets box and streak, and is due this session', () => {
    let s = initialReview(T0)
    s = schedule(s, true, T0)
    s = schedule(s, true, T0) // box 3
    expect(s.box).toBe(3)

    s = schedule(s, false, T0) // wrong -> box 1
    expect(s.box).toBe(1)
    expect(s.streak).toBe(0)
    expect(s.dueAt).toBe(T0) // interval 0 — resurfaces immediately
    expect(isDue(s, T0)).toBe(true)
  })
})

describe('intervalForBox', () => {
  it('matches the box table and clamps out-of-range', () => {
    expect(intervalForBox(1)).toBe(BOX_INTERVALS_MS[0])
    expect(intervalForBox(5)).toBe(BOX_INTERVALS_MS[4])
    expect(intervalForBox(0)).toBe(BOX_INTERVALS_MS[0])
    expect(intervalForBox(99)).toBe(BOX_INTERVALS_MS[4])
  })
})

describe('masteryWeight', () => {
  it('is 0 for unseen and 1 at box 5', () => {
    expect(masteryWeight(undefined)).toBe(0)
    expect(masteryWeight(initialReview(T0))).toBe(0) // box 1
    let s = initialReview(T0)
    for (let i = 0; i < 4; i++) s = schedule(s, true, T0) // -> box 5
    expect(masteryWeight(s)).toBe(1)
  })
})
