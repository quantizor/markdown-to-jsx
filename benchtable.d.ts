/**
 * Type definitions for benchtable
 */

declare module 'benchtable' {
  import Benchmark = require('benchmark')

  interface Table {
    push(item: Record<string, string[]>): void
    toString(): string
  }

  interface BenchTableOptions extends Benchmark.Options {
    isTransposed?: boolean
  }

  interface CycleEvent extends Benchmark.Event {
    target: Benchmark.Target
  }

  class BenchTable extends Benchmark.Suite {
    table: Table
    _counter: number
    _transposed: boolean

    constructor(name?: string, options?: BenchTableOptions)

    addFunction(
      name: string,
      fun: (...args: unknown[]) => unknown,
      options?: Benchmark.Options
    ): this

    addInput(name: string, input: unknown[]): this
  }

  export = BenchTable
}
