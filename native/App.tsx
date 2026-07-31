import Markdown from 'markdown-to-jsx/native'
import { Component, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { CASES, MARKDOWN_OPTIONS } from './fixture'

/**
 * Showcase app for the live native harness. Each fixture case renders inside
 * its own error boundary so a crashing case logs a CASE_THREW sentinel to the
 * Metro console and shows a THREW marker on screen instead of taking down the
 * whole page. The footer END sentinel confirms every case mounted.
 *
 * Consumes the library from source (see metro.config.js), so edits under
 * lib/src hot-reload here. Requires Watchman for that loop to work.
 */
interface BoundaryProps {
  children: ReactNode
  index: number
  name: string
}

interface BoundaryState {
  message: string | null
}

class CaseBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { message: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { message: error.message }
  }

  componentDidCatch(error: Error) {
    console.error(
      'CASE_THREW ' +
        this.props.index +
        ' "' +
        this.props.name +
        '": ' +
        error.message
    )
  }

  render() {
    if (this.state.message !== null) {
      return <Text style={styles.threw}>THREW: {this.props.name}</Text>
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>markdown-to-jsx native harness</Text>
      {CASES.map((fixtureCase, index) => {
        var label = fixtureCase.ref
          ? `${fixtureCase.id} ${fixtureCase.ref}`
          : fixtureCase.id
        return (
          <View key={fixtureCase.id} style={styles.card}>
            <Text style={styles.label}>{label}</Text>
            <CaseBoundary index={index} name={fixtureCase.id}>
              <Markdown options={MARKDOWN_OPTIONS}>{fixtureCase.md}</Markdown>
            </CaseBoundary>
          </View>
        )
      })}
      <Text style={styles.end}>END - {CASES.length} cases mounted</Text>
    </ScrollView>
  )
}

var styles = StyleSheet.create({
  card: {
    borderColor: '#d0d7de',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 6,
    padding: 12,
  },
  content: {
    padding: 16,
    paddingTop: 56,
  },
  end: {
    color: '#57606a',
    marginVertical: 16,
    textAlign: 'center',
  },
  label: {
    color: '#57606a',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  screen: {
    flex: 1,
  },
  threw: {
    color: '#cf222e',
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
})
