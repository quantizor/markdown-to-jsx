import { describe, expect, test } from 'bun:test'
import { scorePaired, scoreTiny, type Verdict } from './metrics-gate.ts'
import { quantile } from './metrics-targets.ts'

// Limits and ratios below are powers of two (25, 12.5, 1.0625, ...), so the
// percent arithmetic is exact in floating point and a value sitting on a limit
// is exactly on it.
const LIMITS = { limitPct: 25, spreadLimitPct: 12.5 }

const ratios = (ratioP25: number, ratio: number, ratioP75: number) => ({
  ratio,
  ratioP25,
  ratioP75,
})

type Ratios = ReturnType<typeof ratios>

describe('scorePaired', () => {
  const rows: [
    name: string,
    first: Ratios,
    second: Ratios,
    expected: { corrected: number; spreadPct: number; verdict: Verdict },
  ][] = [
    [
      'passes a tight row under the limit',
      ratios(1.0, 1.0625, 1.0625),
      ratios(1.0, 1.0625, 1.0625),
      { corrected: 1.0625, spreadPct: 6.25, verdict: 'ok' },
    ],
    [
      'passes a candidate faster than the baseline',
      ratios(0.875, 0.9375, 1.0),
      ratios(0.875, 0.9375, 1.0),
      { corrected: 0.9375, spreadPct: 12.5, verdict: 'ok' },
    ],
    [
      'fails a tight row over the limit',
      ratios(1.4375, 1.5, 1.5),
      ratios(1.4375, 1.5, 1.5),
      { corrected: 1.5, spreadPct: 6.25, verdict: 'FAIL' },
    ],
    [
      'reports NOISY when the spread is wide and the interval straddles the limit',
      ratios(1.0, 1.1875, 1.375),
      ratios(1.0, 1.1875, 1.375),
      { corrected: 1.1875, spreadPct: 37.5, verdict: 'NOISY' },
    ],
    [
      'reports NOISY, not FAIL, when the median is over but the lower quartile is under',
      ratios(1.1875, 1.3125, 1.5),
      ratios(1.1875, 1.3125, 1.5),
      { corrected: 1.3125, spreadPct: 31.25, verdict: 'NOISY' },
    ],
    [
      'fails despite a wide spread when the lower quartile is over the limit in both orders',
      ratios(1.3125, 1.5, 1.75),
      ratios(1.3125, 1.5, 1.75),
      { corrected: 1.5, spreadPct: 43.75, verdict: 'FAIL' },
    ],
    [
      'reports NOISY when the lower quartile is over the limit in only one order',
      ratios(1.3125, 1.5, 1.75),
      ratios(1.0, 1.5, 1.75),
      { corrected: 1.5, spreadPct: 75, verdict: 'NOISY' },
    ],
    [
      'reports NOISY when the lower quartile sits exactly on the limit',
      ratios(1.25, 1.5, 1.75),
      ratios(1.25, 1.5, 1.75),
      { corrected: 1.5, spreadPct: 50, verdict: 'NOISY' },
    ],
    [
      'passes when one order is over, one is under, and the mean is under',
      ratios(1.3125, 1.375, 1.4375),
      ratios(1.0, 1.0625, 1.125),
      { corrected: 1.218_75, spreadPct: 12.5, verdict: 'ok' },
    ],
    [
      'fails when one order is over, one is under, and the mean is over',
      ratios(1.4375, 1.5, 1.5625),
      ratios(1.0, 1.0625, 1.125),
      { corrected: 1.281_25, spreadPct: 12.5, verdict: 'FAIL' },
    ],
    [
      'reports NOISY when only one order has a wide spread',
      ratios(1.0, 1.0625, 1.375),
      ratios(1.0, 1.0625, 1.0625),
      { corrected: 1.0625, spreadPct: 37.5, verdict: 'NOISY' },
    ],
    [
      'passes a corrected delta exactly at the limit',
      ratios(1.25, 1.25, 1.25),
      ratios(1.25, 1.25, 1.25),
      { corrected: 1.25, spreadPct: 0, verdict: 'ok' },
    ],
    [
      'fails a corrected delta just above the limit',
      ratios(1.25, 1.25, 1.25),
      ratios(1.3125, 1.3125, 1.3125),
      { corrected: 1.281_25, spreadPct: 0, verdict: 'FAIL' },
    ],
    [
      'passes a spread exactly at the spread limit',
      ratios(1.0, 1.0625, 1.125),
      ratios(1.0, 1.0625, 1.125),
      { corrected: 1.0625, spreadPct: 12.5, verdict: 'ok' },
    ],
    [
      'reports NOISY for a spread just above the spread limit',
      ratios(1.0, 1.0625, 1.156_25),
      ratios(1.0, 1.0625, 1.156_25),
      { corrected: 1.0625, spreadPct: 15.625, verdict: 'NOISY' },
    ],
  ]

  test.each(rows)('%s', (_name, first, second, expected) => {
    expect(scorePaired(first, second, LIMITS)).toEqual(expected)
  })
})

describe('scoreTiny', () => {
  // Eight samples sort to a quartile rank of 1, median rank of 3, and upper
  // quartile rank of 5, so these three values land on those ranks.
  const samples = (low: number, mid: number, high: number) => [
    low,
    low,
    mid,
    mid,
    high,
    high,
    high,
    high,
  ]

  const rows: [
    name: string,
    baseline: number[],
    candidate: number[],
    expected: { ratio: number; verdict: Verdict },
  ][] = [
    [
      'passes a candidate within the limit',
      samples(1, 1, 1),
      samples(1, 1.0625, 1.0625),
      { ratio: 1.0625, verdict: 'ok' },
    ],
    [
      'passes a candidate faster than the baseline',
      samples(1, 1, 1),
      samples(0.5, 0.5, 0.5),
      { ratio: 0.5, verdict: 'ok' },
    ],
    [
      'fails a tight candidate over the limit',
      samples(1, 1, 1),
      samples(1.4375, 1.5, 1.5),
      { ratio: 1.5, verdict: 'FAIL' },
    ],
    [
      'reports NOISY when the candidate spread is wide and the median is under the limit',
      samples(1, 1, 1),
      samples(1, 1.1875, 1.375),
      { ratio: 1.1875, verdict: 'NOISY' },
    ],
    [
      'reports NOISY, not FAIL, when the median is over but the lower quartile is not',
      samples(1, 1, 1),
      samples(1.125, 1.5, 1.875),
      { ratio: 1.5, verdict: 'NOISY' },
    ],
    [
      'fails despite a wide spread when the candidate lower quartile clears the limit',
      samples(1, 1, 1),
      samples(1.3125, 1.5, 1.875),
      { ratio: 1.5, verdict: 'FAIL' },
    ],
    [
      'reports NOISY when only the baseline spread is wide',
      samples(0.875, 1, 1.125),
      samples(1, 1, 1),
      { ratio: 1, verdict: 'NOISY' },
    ],
    [
      'fails despite a wide baseline spread when the candidate lower quartile clears the baseline upper quartile by the limit',
      samples(0.875, 1, 1.125),
      samples(1.5, 1.5, 1.5),
      { ratio: 1.5, verdict: 'FAIL' },
    ],
    [
      'measures the favorable bound against the baseline upper quartile, not its median',
      samples(0.875, 1, 1.125),
      samples(1.375, 1.5, 1.5),
      { ratio: 1.5, verdict: 'NOISY' },
    ],
    [
      'passes a ratio exactly at the limit',
      samples(1, 1, 1),
      samples(1.25, 1.25, 1.25),
      { ratio: 1.25, verdict: 'ok' },
    ],
    [
      'fails a ratio just above the limit',
      samples(1, 1, 1),
      samples(1.3125, 1.3125, 1.3125),
      { ratio: 1.3125, verdict: 'FAIL' },
    ],
    [
      'passes a spread exactly at the spread limit',
      samples(1, 1, 1),
      samples(1, 1, 1.125),
      { ratio: 1, verdict: 'ok' },
    ],
    [
      'reports NOISY for a spread just above the spread limit',
      samples(1, 1, 1),
      samples(1, 1, 1.156_25),
      { ratio: 1, verdict: 'NOISY' },
    ],
  ]

  test.each(rows)('%s', (_name, baseline, candidate, expected) => {
    const score = scoreTiny(baseline, candidate, LIMITS)

    expect({ ratio: score.ratio, verdict: score.verdict }).toEqual(expected)
  })

  test('reports the quartiles of unsorted samples', () => {
    const score = scoreTiny(
      [5, 1, 8, 3, 7, 2, 6, 4],
      [10, 30, 20, 80, 40, 70, 50, 60],
      LIMITS
    )

    expect(score.baseline).toEqual({ high: 6, low: 2, mid: 4 })
    expect(score.candidate).toEqual({ high: 60, low: 20, mid: 40 })
  })
})

describe('quantile', () => {
  test.each([
    [0.25, 2],
    [0.5, 4],
    [0.75, 6],
    [0, 1],
    [1, 8],
  ])('ranks %f of eight unsorted values as %f', (q, expected) => {
    expect(quantile([5, 1, 8, 3, 7, 2, 6, 4], q)).toBe(expected)
  })

  test('leaves the input order untouched', () => {
    const values = [3, 1, 2]
    quantile(values, 0.5)

    expect(values).toEqual([3, 1, 2])
  })
})
