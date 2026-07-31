import { describe, expect, it } from '@jest/globals'
import { render } from '@testing-library/react-native'
import Markdown from 'markdown-to-jsx/native'
import { CASES, MARKDOWN_OPTIONS } from '../fixture'

/**
 * Smoke suite for the built markdown-to-jsx/native artifact (node_modules
 * resolves the workspace package through its exports map to lib/dist). The
 * Metro dev loop deliberately consumes source instead; this suite validates
 * what actually ships. Runs under jest-expo, never under bun test: the root
 * bunfig prunes this workspace from bun's discovery.
 *
 * RNTL 14's render() returns a Promise; await it and query from the result
 * rather than the screen proxy (the proxy is not reliable under bun's
 * isolated install layout).
 */
describe('markdown-to-jsx/native built package', () => {
  it('renders every shared case without throwing', async () => {
    for (var i = 0; i < CASES.length; i++) {
      var c = CASES[i]
      // Some cases (comments, stripped frontmatter) can yield a null tree;
      // the contract is no throw.
      await render(<Markdown options={MARKDOWN_OPTIONS}>{c.md}</Markdown>)
    }
    expect(CASES.length).toBeGreaterThan(50)
  })

  it('renders semantic smoke queries on representative cases', async () => {
    var screen = await render(
      <Markdown options={MARKDOWN_OPTIONS}>
        {[
          '# Entity &amp; heading',
          '## Dup',
          '## Dup',
          '- alpha\n- beta',
          '[safe link](https://example.com)',
          '[unsafe link](javascript:alert(1))',
          '1. First\n2. Second with **bold text**',
        ].join('\n\n')}
      </Markdown>
    )

    screen.getByText('Entity & heading')
    expect(screen.getAllByText('Dup')).toHaveLength(2)
    screen.getByText('alpha')
    screen.getByText('beta')
    expect(screen.getByText('safe link').props.onPress).toBeInstanceOf(Function)
    expect(screen.getByText('unsafe link').props.onPress).toBeUndefined()
    screen.getByText('bold text')
  })

  it('matches the headings-case tree snapshot', async () => {
    // prettierPath: null in package.json: Jest 29 cannot format inline
    // snapshots under Prettier 3, so formatting is disabled for this suite.
    var heading = CASES.find(function (c) {
      return c.id === 'heading-atx'
    })
    expect(heading).toBeDefined()
    var screen = await render(<Markdown>{heading!.md}</Markdown>)
    expect(screen.toJSON()).toMatchInlineSnapshot(`
<View>
  <Text
    style={
      [
        {
          "fontSize": 16,
          "lineHeight": 24,
        },
        {
          "fontSize": 28,
          "fontWeight": "600",
          "lineHeight": 36,
          "marginBottom": 12,
          "marginTop": 8,
        },
      ]
    }
  >
    Top
  </Text>
  <Text
    style={
      [
        {
          "fontSize": 16,
          "lineHeight": 24,
        },
        {
          "fontSize": 16,
          "fontWeight": "600",
          "lineHeight": 24,
          "marginBottom": 8,
          "marginTop": 8,
        },
      ]
    }
  >
    Deep
  </Text>
</View>
`)
  })
})
