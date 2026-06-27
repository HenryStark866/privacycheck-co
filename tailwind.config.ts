import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', // Cyan/Teal accent
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        navy: {
          700: '#1e293b', // Slate 800
          800: '#0f172a', // Slate 900
          900: '#020617', // Slate 950
          950: '#000000',
        },
        surface: {
          50:  'rgba(255,255,255,0.02)',
          100: 'rgba(255,255,255,0.05)',
          200: 'rgba(255,255,255,0.1)',
          300: 'rgba(255,255,255,0.15)',
        },
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50:  '#fef2f2',
          100: '#fee2e2',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        card:        '0 1px 3px 0 rgba(0,0,0,0.4), 0 4px 16px -2px rgba(0,0,0,0.5)',
        'card-hover':'0 4px 6px -1px rgba(0,0,0,0.5), 0 10px 32px -4px rgba(0,0,0,0.6), 0 0 15px rgba(45, 212, 191, 0.2)',
        floating:    '0 20px 60px -12px rgba(0,0,0,0.7)',
        glow:        '0 0 20px rgba(45, 212, 191, 0.4)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)`,
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};

export default config;
