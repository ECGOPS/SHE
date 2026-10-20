/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: { preflight: false }, // MUI handles base styles
  theme: {
    extend: {
      colors: {
        ecg: {
          navy: '#0B1A2B',
          blue: '#0B5394',
          gold: '#FBB040',
          green: '#2E7D32',
          red: '#C62828',
        },
      },
    },
  },
  plugins: [],
};
