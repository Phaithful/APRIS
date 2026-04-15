const axios = require('axios');

// Nigerian state → region mapping
const STATE_REGION = {
  kano: 'north', kaduna: 'north', katsina: 'north', sokoto: 'north',
  zamfara: 'north', kebbi: 'north', jigawa: 'north', bauchi: 'north',
  gombe: 'north', yobe: 'north', borno: 'north', adamawa: 'north',
  taraba: 'north', niger: 'north', kwara: 'north', plateau: 'north',
  nasarawa: 'north', benue: 'north', kogi: 'north', fct: 'north',
  lagos: 'south_west', ogun: 'south_west', oyo: 'south_west',
  osun: 'south_west', ondo: 'south_west', ekiti: 'south_west',
  anambra: 'south_east', enugu: 'south_east', imo: 'south_east',
  abia: 'south_east', ebonyi: 'south_east',
  rivers: 'south_south', delta: 'south_south', bayelsa: 'south_south',
  akwa_ibom: 'south_south', cross_river: 'south_south', edo: 'south_south',
};

// Fallback fixture used only when both live APIs fail
const MOCK_WEATHER = {
  temperature: 28.4,
  humidity: 72,
  rainfall: 0,
  wind_speed: 3.2,
  condition: 'Partly cloudy',
  isMock: true,
};

function getSeason() {
  const month = new Date().getMonth() + 1; // 1–12
  if (month >= 11 || month <= 2) return 'harmattan';
  if (month >= 3 && month <= 7) return 'dry';
  return 'wet';
}

function getRegionFromState(state = '') {
  const key = state.toLowerCase().replace(/\s+/g, '_');
  return STATE_REGION[key] || 'south_west';
}

// Map WMO weather code to a readable condition (used by Open-Meteo fallback)
function wmoCondition(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain showers';
  return 'Thunderstorm';
}

async function getWeather(lat, lon, state) {
  const season = getSeason();
  const region = getRegionFromState(state);
  const apiKey = process.env.WEATHERAPI_KEY;

  // Primary: WeatherAPI.com (api key required)
  if (apiKey) {
    try {
      const { data } = await axios.get('http://api.weatherapi.com/v1/current.json', {
        params: { key: apiKey, q: `${lat},${lon}`, aqi: 'no' },
        timeout: 6000,
      });
      const c = data.current;
      return {
        temperature: parseFloat(c.temp_c.toFixed(1)),
        humidity: c.humidity,
        rainfall: c.precip_mm || 0,
        wind_speed: parseFloat((c.wind_kph / 3.6).toFixed(1)), // kph → m/s
        condition: c.condition.text,
        season,
        region,
        isMock: false,
      };
    } catch (err) {
      console.warn('WeatherAPI.com failed, falling back to Open-Meteo:', err.message);
    }
  }

  // Fallback: Open-Meteo (no key required)
  try {
    const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
        timezone: 'Africa/Lagos',
      },
      timeout: 6000,
    });
    const c = data.current;
    return {
      temperature: parseFloat(c.temperature_2m.toFixed(1)),
      humidity: c.relative_humidity_2m,
      rainfall: c.precipitation || 0,
      wind_speed: parseFloat((c.wind_speed_10m || 0).toFixed(1)),
      condition: wmoCondition(c.weather_code),
      season,
      region,
      isMock: false,
    };
  } catch (err) {
    console.warn('Open-Meteo also failed, using mock data:', err.message);
    return { ...MOCK_WEATHER, season, region };
  }
}

module.exports = { getWeather, getSeason, getRegionFromState };
