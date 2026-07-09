// The workshop renders the *exact* CSS the app ships — the shared design tokens
// plus the app stylesheet — so a component here can never drift from the app.
// Import order mirrors build.py's CSS_PARTS (tokens first, so var(--…) resolves).
import '../design/tokens.css';
import '../build/src/app.css';
import './preview.css'; // workshop backdrop only — NOT shipped

/** @type {import('@storybook/web-components').Preview} */
export default {
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'ground',
      values: [
        { name: 'ground', value: '#0d1512' },
        { name: 'ground-2', value: '#101c17' },
        { name: 'ink', value: '#e9ede6' },
      ],
    },
    options: {
      storySort: {
        order: ['Design', ['Introduction', 'Foundations'], 'Components'],
      },
    },
  },
};
