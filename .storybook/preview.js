// The workshop renders the *exact* CSS the app ships — the shared design tokens
// plus the app stylesheet — so a component here can never drift from the app.
// Import order mirrors build.py's CSS_PARTS (tokens first, so var(--…) resolves).
import '../design/fonts.css';
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
        { name: 'ground', value: '#101215' },
        { name: 'ground-2', value: '#15181c' },
        { name: 'ink', value: '#e8eaed' },
      ],
    },
    options: {
      storySort: {
        order: ['Design', ['Introduction', 'Foundations'], 'Components'],
      },
    },
  },
};
