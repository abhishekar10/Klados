/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  // 'class' (not the default 'media') so Settings' theme choice can override the OS scheme —
  // see store/settings.ts + app/_layout.tsx, which call nativewind's setColorScheme('system').
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
