const nextConfig = require('eslint-config-next')

module.exports = [
  ...nextConfig,
  {
    ignores: [
      'public/lib/*.min.js',
      'android/**'
    ]
  },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off'
    }
  }
]
