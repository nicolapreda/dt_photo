module.exports = {
  content: ["./public/*.{html,js}", "./src/**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily: {
        'display': ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        'sans': ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        'dt-black': '#000000',
        'dt-white': '#FFFFFF',
        'dt-gray': '#1a1a1a',
        'dt-gray-light': '#333333',
        'dt-gray-lighter': '#666666',
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-in-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'scale-in': 'scaleIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
};