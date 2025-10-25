# Render Depth Limit

**MAX_RENDER_DEPTH = 2500 levels**

## Quick Summary

- **Breaking point**: ~3000 levels
- **Safety margin**: 1.2x
- **Handles**: ~5,000 consecutive asterisks
- **Performance**: O(1) overhead

## Testing Results

| Depth | Characters | Result     | Time  |
| ----- | ---------- | ---------- | ----- |
| 1000  | 2,000      | ✓ OK       | 14ms  |
| 2000  | 4,000      | ✓ OK       | 48ms  |
| 2500  | 5,000      | ✓ OK       | ~52ms |
| 2600  | 5,200      | ✓ Fallback | ~55ms |

## Why 2500?

- 2.5x increase from original 1000 limit
- Safe margin below actual breaking point
- Handles extreme cases without crashing
- Graceful fallback for adversarial input

## Real-World Usage

- Normal formatting: 1-3 levels ✓
- Complex docs: 5-20 levels ✓
- Edge cases: 50-200 levels ✓
- Extreme: 1,000-5,000 chars ✓
- Adversarial: 5,000+ chars → fallback ✓
