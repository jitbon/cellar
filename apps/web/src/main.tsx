import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { LocalStorageStore } from './adapters/localStorageStore';
import { OpenMeteoWeatherService } from './adapters/openMeteoWeatherService';
import { Outbox } from './adapters/outbox';
import { SupabaseAuthService } from './adapters/supabaseAuthService';
import { SupabasePlaceSearch } from './adapters/supabasePlaceSearch';
import { SupabaseTripRepository } from './adapters/supabaseTripRepository';
import { WikimediaCityPhotos } from './adapters/wikimediaCityPhotos';
import { supabase } from './lib/supabaseClient';
import { ServicesProvider } from './state/services';
import '@fontsource-variable/public-sans';
import './styles/tokens.css';
import './styles/global.css';

const auth = new SupabaseAuthService(supabase);
const repo = new SupabaseTripRepository(supabase);
const outbox = new Outbox((changes) => repo.save(changes));
const weather = new OpenMeteoWeatherService();
const places = new SupabasePlaceSearch(supabase);
const store = new LocalStorageStore();
const cityPhotos = new WikimediaCityPhotos(store);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider
      services={{ auth, repo, outbox, weather, places, cityPhotos, store, ready: auth.ready }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ServicesProvider>
  </StrictMode>,
);
