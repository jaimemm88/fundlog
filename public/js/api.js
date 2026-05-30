// ─── API client ──────────────────────────────────────────────────────────────
const API = {
  async _fetch(method, url, body) {
    const token = localStorage.getItem('tv_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (res.status === 401) {
      localStorage.removeItem('tv_token');
      localStorage.removeItem('tv_user');
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Error de servidor');
    }
    return res.json();
  },
  get:    (url, params) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return API._fetch('GET', url + q);
  },
  post:   (url, body) => API._fetch('POST', url, body),
  put:    (url, body) => API._fetch('PUT', url, body),
  delete: (url)       => API._fetch('DELETE', url),

  // Accounts
  accounts: {
    list:   ()       => API.get('/api/accounts'),
    get:    (id)     => API.get(`/api/accounts/${id}`),
    create: (data)   => API.post('/api/accounts', data),
    update: (id, d)  => API.put(`/api/accounts/${id}`, d),
    delete: (id)     => API.delete(`/api/accounts/${id}`),
  },
  // Trades
  trades: {
    list:     (p)    => API.get('/api/trades', p),
    summary:  (p)    => API.get('/api/trades/summary', p),
    daily:    (p)    => API.get('/api/trades/daily-pnl', p),
    get:      (id)   => API.get(`/api/trades/${id}`),
    create:   (data) => API.post('/api/trades', data),
    update:   (id,d) => API.put(`/api/trades/${id}`, d),
    delete:   (id)   => API.delete(`/api/trades/${id}`),
  },
  // Strategies
  strategies: {
    list:   ()       => API.get('/api/strategies'),
    get:    (id)     => API.get(`/api/strategies/${id}`),
    create: (data)   => API.post('/api/strategies', data),
    update: (id, d)  => API.put(`/api/strategies/${id}`, d),
    delete: (id)     => API.delete(`/api/strategies/${id}`),
  },
  // Funding
  funding: {
    list:    (p)    => API.get('/api/funding', p),
    summary: (p)    => API.get('/api/funding/summary', p),
    create:  (data) => API.post('/api/funding', data),
    delete:  (id)   => API.delete(`/api/funding/${id}`),
  },
  // Goals
  goals: {
    list:   ()       => API.get('/api/goals'),
    create: (data)   => API.post('/api/goals', data),
    update: (id, d)  => API.put(`/api/goals/${id}`, d),
    delete: (id)     => API.delete(`/api/goals/${id}`),
  },
  // Analysis
  analysis: {
    stats:     (p) => API.get('/api/analysis/stats', p),
    byPair:    (p) => API.get('/api/analysis/by-pair', p),
    bySession: (p) => API.get('/api/analysis/by-session', p),
    byWeekday: (p) => API.get('/api/analysis/by-weekday', p),
    byStrategy:(p) => API.get('/api/analysis/by-strategy', p),
    equity:    (p) => API.get('/api/analysis/equity', p),
    monthly:   (p) => API.get('/api/analysis/monthly', p),
  },
  // Economic Calendar
  ecoCalendar: {
    list:   (p)    => API.get('/api/economic-calendar', p),
    create: (data) => API.post('/api/economic-calendar', data),
    update: (id,d) => API.put(`/api/economic-calendar/${id}`, d),
    delete: (id)   => API.delete(`/api/economic-calendar/${id}`),
  },
  // Journal
  journal: {
    list:   (p)    => API.get('/api/journal', p),
    getDay: (date) => API.get(`/api/journal/${date}`),
    save:   (data) => API.post('/api/journal', data),
    delete: (date) => API.delete(`/api/journal/${date}`),
  },
  // Risk
  risk: {
    get:  (p)    => API.get('/api/risk', p),
    save: (data) => API.put('/api/risk', data),
  },
  // Backtesting
  backtesting: {
    list:   ()     => API.get('/api/backtesting'),
    run:    (data) => API.post('/api/backtesting/run', data),
    delete: (id)   => API.delete(`/api/backtesting/${id}`),
  },
};
