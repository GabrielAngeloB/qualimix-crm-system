import { describe, expect, it } from 'vitest'
import { sortNewestFirst } from './ordering'

describe('sortNewestFirst', () => {
  it('places the newest timestamp first, including records created on the same day', () => {
    const records = [
      { id: 'old', createdAt: '2026-11-06T12:00:00.000Z' },
      { id: 'newest', createdAt: '2026-11-08T18:30:00.000Z' },
      { id: 'middle', createdAt: '2026-11-08T17:00:00.000Z' },
    ]

    expect(sortNewestFirst(records).map((record) => record.id)).toEqual(['newest', 'middle', 'old'])
  })

  it('does not mutate the original array', () => {
    const records = [
      { id: 'old', createdAt: '2026-11-06T12:00:00.000Z' },
      { id: 'new', createdAt: '2026-11-08T18:30:00.000Z' },
    ]

    const sorted = sortNewestFirst(records)

    expect(sorted).not.toBe(records)
    expect(records[0].id).toBe('old')
  })
})
