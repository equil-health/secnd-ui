/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Display: Fraunces — variable serif for headlines, card titles,
        // signal stat values. Falls back to Georgia-class serifs so a
        // flash of system serif still feels right instead of defaulting
        // to sans.
        display: [
          'Fraunces',
          'ui-serif',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'Times',
          'serif',
        ],
        // UI sans — Inter. This is also the body default (see index.css).
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        // Mono — for stats, timings, IDs, code. JetBrains Mono has the
        // tabular-style figures we want for data rows.
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      // Display-grade letter-spacing: tighter than Tailwind's default
      // tracking-tight. Fraunces at 900 weight benefits from -0.025em.
      letterSpacing: {
        'display-tight': '-0.025em',
        eyebrow: '0.22em',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
