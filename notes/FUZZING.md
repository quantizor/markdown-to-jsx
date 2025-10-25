# Fuzzing Tests

**Purpose**: Stress test exponential backtracking protections

## Quick Stats

- **36 comprehensive tests**
- **Run**: `yarn test:fuzz`
- **Timeout**: 100ms per test
- **Categories**: HTML parsing, inline formatting, combined attacks, repetitive delimiters, random fuzzing

## Test Categories

1. **HTML Block Parsing** - Nested tags up to 200 levels
2. **Inline Formatting** - Delimiters up to 50 levels
3. **Combined Attacks** - Mixed features (HTML + formatting, lists, tables)
4. **Repetitive Sequences** - Up to 10,000+ chars of repetitive delimiters
5. **Random Fuzzing** - 100 random inputs
6. **Performance** - Basic parsing under 10ms, linear scaling

## Key Protections Tested

- Deeply nested HTML (`<div>`...`</div>` × 200)
- Alternating delimiters (`*_*_*_...` × 1000)
- Incomplete sequences (thousands of opens, few closes)
- Very long sequences (10,000+ chars)
- Adversarial patterns (mismatched, malformed)

## Metrics

All tests must complete in **< 100ms** to pass.
