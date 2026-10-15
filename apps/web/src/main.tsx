import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { LocalStorageStore } from './adapters/localStorageStore';
import { OpenMeteoWeatherService } from './adapters/openMeteoWeatherService';
import { Outbox } from './adapters/outbox';
import { SupabaseAuthService } from './adapters/supabaseAuthService';
import { SupabaseTripRepository } from './adapters/supabaseTripRepository';
import { supabase } from './lib/supabaseClient';
import { ServicesProvider } from './state/services';
import './styles/tokens.css';
import './styles/global.css';

const auth = new SupabaseAuthService(supabase);
const repo = new SupabaseTripRepository(supabase);
const outbox = new Outbox((changes) => repo.save(changes));
const weather = new OpenMeteoWeatherService();
const store = new LocalStorageStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={{ auth, repo, outbox, weather, store, ready: auth.ready }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ServicesProvider>
  </StrictMode>,
);
