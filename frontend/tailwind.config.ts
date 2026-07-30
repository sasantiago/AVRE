import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Paleta AVRE (sección 8 del doc de requerimientos): 0F172A/1E293B/64748B/6366F1/F8FAFC.
// Se expone como tokens propios además de los slate/indigo que ya usa AvreLanding.jsx
// (migrado tal cual desde el remoto), para que el resto de la UI (login/registro/
// onboarding) pueda referenciarlos semánticamente.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        avre: {
          bg: '#0F172A',
          surface: '#1E293B',
          muted: '#64748B',
          accent: '#6366F1',
          light: '#F8FAFC',
        },
      },
      borderRadius: {
        avre: '18px',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
