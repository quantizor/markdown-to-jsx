/**
 * Preact page entry: the React mounting module, built with `react` aliased to
 * preact/compat (vite.preact.config.ts). Exercises the React renderer's
 * delegation to the host runtime's createElement.
 */

import { mountReact } from '../src/react-mount'

mountReact('preact-root')
