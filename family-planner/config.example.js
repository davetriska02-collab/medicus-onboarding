// Copy this file to config.js and fill in your API keys
// config.js is gitignored — your keys stay local
export const CONFIG = {
  weather: {
    apiKey: 'YOUR_OPENWEATHERMAP_API_KEY',
    lat: 51.1284,
    lon: -0.6505,
    units: 'metric'
  },
  trains: {
    username: 'YOUR_RTT_USERNAME',
    password: 'YOUR_RTT_PASSWORD',
    station: 'WIT'
  },
  calendars: [
    // { name: 'Family', url: 'https://calendar.google.com/...ical', color: '#58a6ff' }
  ],
  family: {
    members: [
      // { name: 'Mum', color: '#58a6ff', emoji: '👩' },
      // { name: 'Dad', color: '#f78166', emoji: '👨' },
    ]
  },
  display: {
    clockFormat: '24h',
    screensaverTimeout: 5,
    theme: 'dark'
  }
};
