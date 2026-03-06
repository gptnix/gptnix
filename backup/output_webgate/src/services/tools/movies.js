'use strict';

// Movies / TV metadata tool
// Primary: TMDB (poster/backdrop/cast/crew)
// Fallback/complement: OMDb (IMDb ratings + some metadata)

const {
  TMDB_BEARER_TOKEN,
  TMDB_API_KEY,
  TMDB_API_BASE,
  OMDB_API_KEY,
  OMDB_API_BASE,
} = require('../../config/env');

const _cache = new Map();

function _now() {
  return Date.now();
}

function _cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (e.exp && e.exp < _now()) {
    _cache.delete(key);
    return null;
  }
  return e.val;
}

function _cacheSet(key, val, ttlMs) {
  _cache.set(key, { val, exp: _now() + ttlMs });
}

function _pickLocale(languageHint) {
  const raw = String(languageHint || '').trim().toLowerCase();
  const short = raw.split(/[-_]/)[0];
  // TMDB expects language like hr-HR. We'll default to en-US.
  if (short === 'hr') return 'hr-HR';
  if (short === 'bs') return 'bs-BA';
  if (short === 'sr') return 'sr-RS';
  if (short === 'de') return 'de-DE';
  if (short === 'fr') return 'fr-FR';
  if (short === 'it') return 'it-IT';
  if (short === 'es') return 'es-ES';
  return 'en-US';
}

function _reportLang(languageHint) {
  const raw = String(languageHint || '').trim().toLowerCase();
  const short = raw.split(/[-_]/)[0];
  if (['hr', 'bs', 'sr'].includes(short)) return 'hr';
  return 'en';
}

async function _fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 9000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_e) {
      json = null;
    }
    if (!res.ok) {
      const msg = (json && (json.status_message || json.Error || json.error || json.message)) || text || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = json;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

function _hasTmdbAuth() {
  return Boolean(String(TMDB_BEARER_TOKEN || '').trim() || String(TMDB_API_KEY || '').trim());
}

function _tmdbHeaders() {
  const h = { accept: 'application/json' };
  if (String(TMDB_BEARER_TOKEN || '').trim()) {
    h.authorization = `Bearer ${TMDB_BEARER_TOKEN}`;
  }
  return h;
}

function _tmdbAuthParams(url) {
  // If Bearer token is not provided, fall back to v3 api_key query param.
  if (!String(TMDB_BEARER_TOKEN || '').trim() && String(TMDB_API_KEY || '').trim()) {
    url.searchParams.set('api_key', TMDB_API_KEY);
  }
  return url;
}

function _imgUrl(path, size = 'w500') {
  const p = String(path || '').trim();
  if (!p) return '';
  // TMDB canonical image base
  return `https://image.tmdb.org/t/p/${size}${p}`;
}

function _pickYear(dateStr) {
  const s = String(dateStr || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})/);
  return m ? m[1] : '';
}

function _uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const k = String(x || '').trim();
    if (!k) continue;
    const lk = k.toLowerCase();
    if (seen.has(lk)) continue;
    seen.add(lk);
    out.push(k);
  }
  return out;
}

async function tmdbSearchMovie(query, { year, languageHint, maxResults = 6, includeAdult = false } = {}) {
  if (!_hasTmdbAuth()) return { ok: false, error: 'TMDB auth missing (set TMDB_BEARER_TOKEN or TMDB_API_KEY)' };

  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'query required' };

  const lang = _pickLocale(languageHint);
  const cacheKey = `tmdb:search:${lang}:${includeAdult ? '1' : '0'}:${year || ''}:${q.toLowerCase()}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ok: true, ...cached, cached: true };

  const url = _tmdbAuthParams(new URL(`${TMDB_API_BASE}/search/movie`));
  url.searchParams.set('query', q);
  url.searchParams.set('include_adult', includeAdult ? 'true' : 'false');
  url.searchParams.set('language', lang);
  if (year) url.searchParams.set('year', String(year));

  const data = await _fetchJson(String(url), { headers: _tmdbHeaders() });
  const results = Array.isArray(data?.results) ? data.results : [];
  const items = results.slice(0, Math.max(1, Math.min(20, maxResults))).map((r) => {
    const posterPath = r?.poster_path || '';
    const backdropPath = r?.backdrop_path || '';
    const releaseDate = r?.release_date || '';
    return {
      mediaType: 'movie',
      tmdbId: r?.id,
      title: r?.title || r?.name || '',
      originalTitle: r?.original_title || '',
      year: _pickYear(releaseDate),
      releaseDate,
      overview: r?.overview || '',
      popularity: r?.popularity,
      voteAverage: r?.vote_average,
      voteCount: r?.vote_count,
      images: {
        poster_w342: _imgUrl(posterPath, 'w342'),
        poster_w500: _imgUrl(posterPath, 'w500'),
        backdrop_w780: _imgUrl(backdropPath, 'w780'),
        backdrop_w1280: _imgUrl(backdropPath, 'w1280'),
      },
    };
  });

  const out = { provider: 'tmdb', query: q, language: lang, results: items };
  _cacheSet(cacheKey, out, 1000 * 60 * 30);
  return { ok: true, ...out, cached: false };
}

async function tmdbSearchTv(query, { year, languageHint, maxResults = 6, includeAdult = false } = {}) {
  if (!_hasTmdbAuth()) return { ok: false, error: 'TMDB auth missing (set TMDB_BEARER_TOKEN or TMDB_API_KEY)' };

  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'query required' };

  const lang = _pickLocale(languageHint);
  const cacheKey = `tmdb:search:tv:${lang}:${includeAdult ? '1' : '0'}:${year || ''}:${q.toLowerCase()}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ok: true, ...cached, cached: true };

  const url = _tmdbAuthParams(new URL(`${TMDB_API_BASE}/search/tv`));
  url.searchParams.set('query', q);
  url.searchParams.set('include_adult', includeAdult ? 'true' : 'false');
  url.searchParams.set('language', lang);
  if (year) url.searchParams.set('first_air_date_year', String(year));

  const data = await _fetchJson(String(url), { headers: _tmdbHeaders() });
  const results = Array.isArray(data?.results) ? data.results : [];
  const items = results.slice(0, Math.max(1, Math.min(20, maxResults))).map((r) => {
    const posterPath = r?.poster_path || '';
    const backdropPath = r?.backdrop_path || '';
    const firstAirDate = r?.first_air_date || '';
    return {
      mediaType: 'tv',
      tmdbId: r?.id,
      title: r?.name || r?.title || '',
      originalTitle: r?.original_name || '',
      year: _pickYear(firstAirDate),
      firstAirDate,
      overview: r?.overview || '',
      popularity: r?.popularity,
      voteAverage: r?.vote_average,
      voteCount: r?.vote_count,
      images: {
        poster_w342: _imgUrl(posterPath, 'w342'),
        poster_w500: _imgUrl(posterPath, 'w500'),
        backdrop_w780: _imgUrl(backdropPath, 'w780'),
        backdrop_w1280: _imgUrl(backdropPath, 'w1280'),
      },
    };
  });

  const out = { provider: 'tmdb', query: q, language: lang, results: items };
  _cacheSet(cacheKey, out, 1000 * 60 * 30);
  return { ok: true, ...out, cached: false };
}

async function tmdbGetMovieFull(tmdbId, { languageHint, includeImages = true, includeVideos = true } = {}) {
  if (!_hasTmdbAuth()) return { ok: false, error: 'TMDB auth missing (set TMDB_BEARER_TOKEN or TMDB_API_KEY)' };
  const id = Number(tmdbId);
  if (!id) return { ok: false, error: 'tmdbId required' };

  const lang = _pickLocale(languageHint);
  const cacheKey = `tmdb:movie:${lang}:${includeImages ? '1' : '0'}:${includeVideos ? '1' : '0'}:${id}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ok: true, ...cached, cached: true };

  const url = _tmdbAuthParams(new URL(`${TMDB_API_BASE}/movie/${id}`));
  url.searchParams.set('language', lang);

  const append = ['credits', 'external_ids'];
  if (includeImages) append.push('images');
  if (includeVideos) append.push('videos');
  // NOTE: release_dates helps with age ratings in some regions, but it can be heavy.
  append.push('release_dates');
  url.searchParams.set('append_to_response', append.join(','));

  const data = await _fetchJson(String(url), { headers: _tmdbHeaders() });

  // Watch providers (optional, not always available)
  let providers = null;
  try {
    const purl = _tmdbAuthParams(new URL(`${TMDB_API_BASE}/movie/${id}/watch/providers`));
    providers = await _fetchJson(String(purl), { headers: _tmdbHeaders(), timeoutMs: 7000 });
  } catch (_e) {
    providers = null;
  }

  const posterPath = data?.poster_path || '';
  const backdropPath = data?.backdrop_path || '';
  const releaseDate = data?.release_date || '';
  const imdbId = data?.external_ids?.imdb_id || data?.imdb_id || '';

  const credits = data?.credits || {};
  const cast = Array.isArray(credits?.cast) ? credits.cast : [];
  const crew = Array.isArray(credits?.crew) ? credits.crew : [];

  const directors = crew.filter((c) => String(c?.job || '').toLowerCase() === 'director').map((c) => c?.name);
  const writers = crew
    .filter((c) => {
      const j = String(c?.job || '').toLowerCase();
      return j === 'writer' || j === 'screenplay' || j === 'story';
    })
    .map((c) => c?.name);

  const videos = Array.isArray(data?.videos?.results) ? data.videos.results : [];
  const trailers = videos
    .filter((v) => String(v?.site || '').toLowerCase() === 'youtube')
    .map((v) => ({
      name: v?.name || '',
      type: v?.type || '',
      official: Boolean(v?.official),
      key: v?.key || '',
      url: v?.key ? `https://www.youtube.com/watch?v=${v.key}` : '',
    }))
    .filter((v) => v.url)
    .slice(0, 6);

  // Age ratings: pick US/GB/HR if present
  let ageRating = '';
  try {
    const rd = Array.isArray(data?.release_dates?.results) ? data.release_dates.results : [];
    const pick = (cc) => rd.find((x) => String(x?.iso_3166_1 || '').toUpperCase() === cc);
    const bucket = pick('HR') || pick('BA') || pick('US') || pick('GB') || rd[0];
    const rel = Array.isArray(bucket?.release_dates) ? bucket.release_dates : [];
    const cert = rel.map((x) => x?.certification).find((c) => String(c || '').trim());
    ageRating = String(cert || '').trim();
  } catch {
    ageRating = '';
  }

  const movie = {
    mediaType: 'movie',
    tmdbId: id,
    imdbId: imdbId || '',
    title: data?.title || '',
    originalTitle: data?.original_title || '',
    tagline: data?.tagline || '',
    overview: data?.overview || '',
    year: _pickYear(releaseDate),
    releaseDate,
    runtimeMin: data?.runtime || null,
    status: data?.status || '',
    genres: Array.isArray(data?.genres) ? data.genres.map((g) => g?.name).filter(Boolean) : [],
    countries: Array.isArray(data?.production_countries)
      ? data.production_countries.map((c) => c?.name).filter(Boolean)
      : [],
    spokenLanguages: Array.isArray(data?.spoken_languages)
      ? data.spoken_languages.map((l) => l?.english_name || l?.name).filter(Boolean)
      : [],
    ageRating,
    tmdb: {
      voteAverage: data?.vote_average ?? null,
      voteCount: data?.vote_count ?? null,
      popularity: data?.popularity ?? null,
    },
    people: {
      directors: _uniq(directors),
      writers: _uniq(writers),
      castTop: cast
        .slice(0, 18)
        .map((c) => ({ name: c?.name || '', character: c?.character || '', order: c?.order ?? null }))
        .filter((c) => c.name),
    },
    images: {
      poster_w342: _imgUrl(posterPath, 'w342'),
      poster_w500: _imgUrl(posterPath, 'w500'),
      poster_original: _imgUrl(posterPath, 'original'),
      backdrop_w780: _imgUrl(backdropPath, 'w780'),
      backdrop_w1280: _imgUrl(backdropPath, 'w1280'),
      backdrop_original: _imgUrl(backdropPath, 'original'),
    },
    links: {
      tmdb: `https://www.themoviedb.org/movie/${id}`,
      imdb: imdbId ? `https://www.imdb.com/title/${imdbId}/` : '',
    },
    trailers,
    watchProviders: providers?.results || null,
    source: { provider: 'tmdb', language: lang },
  };

  const out = { provider: 'tmdb', movie };
  _cacheSet(cacheKey, out, 1000 * 60 * 60 * 6);
  return { ok: true, ...out, cached: false };
}

async function tmdbGetTvFull(tmdbId, { languageHint, includeImages = true, includeVideos = true } = {}) {
  if (!_hasTmdbAuth()) return { ok: false, error: 'TMDB auth missing (set TMDB_BEARER_TOKEN or TMDB_API_KEY)' };
  const id = Number(tmdbId);
  if (!id) return { ok: false, error: 'tmdbId required' };

  const lang = _pickLocale(languageHint);
  const cacheKey = `tmdb:tv:${lang}:${includeImages ? '1' : '0'}:${includeVideos ? '1' : '0'}:${id}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ok: true, ...cached, cached: true };

  const url = _tmdbAuthParams(new URL(`${TMDB_API_BASE}/tv/${id}`));
  url.searchParams.set('language', lang);

  const append = ['credits', 'external_ids', 'content_ratings'];
  if (includeImages) append.push('images');
  if (includeVideos) append.push('videos');
  url.searchParams.set('append_to_response', append.join(','));

  const data = await _fetchJson(String(url), { headers: _tmdbHeaders() });

  // Watch providers (optional)
  let providers = null;
  try {
    const purl = _tmdbAuthParams(new URL(`${TMDB_API_BASE}/tv/${id}/watch/providers`));
    providers = await _fetchJson(String(purl), { headers: _tmdbHeaders(), timeoutMs: 7000 });
  } catch (_e) {
    providers = null;
  }

  const posterPath = data?.poster_path || '';
  const backdropPath = data?.backdrop_path || '';
  const firstAirDate = data?.first_air_date || '';
  const lastAirDate = data?.last_air_date || '';
  const imdbId = data?.external_ids?.imdb_id || '';

  const credits = data?.credits || {};
  const cast = Array.isArray(credits?.cast) ? credits.cast : [];
  const crew = Array.isArray(credits?.crew) ? credits.crew : [];

  const creators = Array.isArray(data?.created_by) ? data.created_by.map((x) => x?.name).filter(Boolean) : [];
  const directors = crew.filter((c) => String(c?.job || '').toLowerCase() === 'director').map((c) => c?.name);
  const writers = crew
    .filter((c) => {
      const j = String(c?.job || '').toLowerCase();
      return j === 'writer' || j === 'screenplay' || j === 'story';
    })
    .map((c) => c?.name);

  const videos = Array.isArray(data?.videos?.results) ? data.videos.results : [];
  const trailers = videos
    .filter((v) => String(v?.site || '').toLowerCase() === 'youtube')
    .map((v) => ({
      name: v?.name || '',
      type: v?.type || '',
      official: Boolean(v?.official),
      key: v?.key || '',
      url: v?.key ? `https://www.youtube.com/watch?v=${v.key}` : '',
    }))
    .filter((v) => v.url)
    .slice(0, 6);

  // Age ratings: content_ratings
  let ageRating = '';
  try {
    const cr = Array.isArray(data?.content_ratings?.results) ? data.content_ratings.results : [];
    const pick = (cc) => cr.find((x) => String(x?.iso_3166_1 || '').toUpperCase() === cc);
    const bucket = pick('HR') || pick('BA') || pick('US') || pick('GB') || cr[0];
    ageRating = String(bucket?.rating || '').trim();
  } catch {
    ageRating = '';
  }

  const episodeRunTimes = Array.isArray(data?.episode_run_time) ? data.episode_run_time.filter((x) => typeof x === 'number') : [];
  const episodeRuntimeMin = episodeRunTimes.length ? Math.round(episodeRunTimes.reduce((a, b) => a + b, 0) / episodeRunTimes.length) : null;

  const show = {
    mediaType: 'tv',
    tmdbId: id,
    imdbId: imdbId || '',
    title: data?.name || '',
    originalTitle: data?.original_name || '',
    tagline: data?.tagline || '',
    overview: data?.overview || '',
    year: _pickYear(firstAirDate),
    // For compatibility with existing report structure
    releaseDate: firstAirDate,
    firstAirDate,
    lastAirDate,
    runtimeMin: episodeRuntimeMin,
    status: data?.status || '',
    numberOfSeasons: data?.number_of_seasons ?? null,
    numberOfEpisodes: data?.number_of_episodes ?? null,
    genres: Array.isArray(data?.genres) ? data.genres.map((g) => g?.name).filter(Boolean) : [],
    countries: Array.isArray(data?.production_countries)
      ? data.production_countries.map((c) => c?.name).filter(Boolean)
      : [],
    spokenLanguages: Array.isArray(data?.spoken_languages)
      ? data.spoken_languages.map((l) => l?.english_name || l?.name).filter(Boolean)
      : [],
    ageRating,
    tmdb: {
      voteAverage: data?.vote_average ?? null,
      voteCount: data?.vote_count ?? null,
      popularity: data?.popularity ?? null,
    },
    people: {
      creators: _uniq(creators),
      directors: _uniq(directors),
      writers: _uniq(writers),
      castTop: cast
        .slice(0, 18)
        .map((c) => ({ name: c?.name || '', character: c?.character || '', order: c?.order ?? null }))
        .filter((c) => c.name),
    },
    images: {
      poster_w342: _imgUrl(posterPath, 'w342'),
      poster_w500: _imgUrl(posterPath, 'w500'),
      poster_original: _imgUrl(posterPath, 'original'),
      backdrop_w780: _imgUrl(backdropPath, 'w780'),
      backdrop_w1280: _imgUrl(backdropPath, 'w1280'),
      backdrop_original: _imgUrl(backdropPath, 'original'),
    },
    links: {
      tmdb: `https://www.themoviedb.org/tv/${id}`,
      imdb: imdbId ? `https://www.imdb.com/title/${imdbId}/` : '',
    },
    trailers,
    watchProviders: providers?.results || null,
    source: { provider: 'tmdb', language: lang },
  };

  const out = { provider: 'tmdb', movie: show };
  _cacheSet(cacheKey, out, 1000 * 60 * 60 * 6);
  return { ok: true, ...out, cached: false };
}


async function tmdbFindByImdb(imdbId, { languageHint } = {}) {
  if (!_hasTmdbAuth()) return { ok: false, error: 'TMDB auth missing' };
  const id = String(imdbId || '').trim();
  if (!id) return { ok: false, error: 'imdbId required' };

  const lang = _pickLocale(languageHint);
  const cacheKey = `tmdb:find:imdb:${id}:${lang}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ok: true, ...cached, cached: true };

  const url = _tmdbAuthParams(new URL(`${TMDB_API_BASE}/find/${encodeURIComponent(id)}`));
  url.searchParams.set('language', lang);
  url.searchParams.set('external_source', 'imdb_id');
  const data = await _fetchJson(String(url), { headers: _tmdbHeaders(), timeoutMs: 9000 });

  const movieRes = Array.isArray(data?.movie_results) ? data.movie_results : [];
  const tvRes = Array.isArray(data?.tv_results) ? data.tv_results : [];

  const out = {
    provider: 'tmdb',
    imdbId: id,
    movieTmdbId: movieRes?.[0]?.id ?? null,
    tvTmdbId: tvRes?.[0]?.id ?? null,
  };

  _cacheSet(cacheKey, out, 1000 * 60 * 60 * 24);
  return { ok: true, ...out, cached: false };
}


async function omdbByImdb(imdbId) {
  if (!OMDB_API_KEY) return { ok: false, error: 'OMDB_API_KEY missing' };
  const id = String(imdbId || '').trim();
  if (!id) return { ok: false, error: 'imdbId required' };

  const cacheKey = `omdb:imdb:${id}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ok: true, ...cached, cached: true };

  const url = new URL(String(OMDB_API_BASE || 'https://www.omdbapi.com'));
  url.searchParams.set('apikey', OMDB_API_KEY);
  url.searchParams.set('i', id);
  url.searchParams.set('plot', 'full');

  const data = await _fetchJson(String(url), { timeoutMs: 9000 });
  if (!data || String(data?.Response || '').toLowerCase() !== 'true') {
    return { ok: false, error: data?.Error || 'OMDb not found', payload: data };
  }

  const out = { provider: 'omdb', data };
  _cacheSet(cacheKey, out, 1000 * 60 * 60 * 24);
  return { ok: true, ...out, cached: false };
}

async function omdbByTitle(title, { year } = {}) {
  if (!OMDB_API_KEY) return { ok: false, error: 'OMDB_API_KEY missing' };
  const t = String(title || '').trim();
  if (!t) return { ok: false, error: 'title required' };

  const cacheKey = `omdb:title:${year || ''}:${t.toLowerCase()}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ok: true, ...cached, cached: true };

  const url = new URL(String(OMDB_API_BASE || 'https://www.omdbapi.com'));
  url.searchParams.set('apikey', OMDB_API_KEY);
  url.searchParams.set('t', t);
  if (year) url.searchParams.set('y', String(year));
  url.searchParams.set('plot', 'full');

  const data = await _fetchJson(String(url), { timeoutMs: 9000 });
  if (!data || String(data?.Response || '').toLowerCase() !== 'true') {
    return { ok: false, error: data?.Error || 'OMDb not found', payload: data };
  }

  const out = { provider: 'omdb', data };
  _cacheSet(cacheKey, out, 1000 * 60 * 60 * 24);
  return { ok: true, ...out, cached: false };
}

function _mergeOmdbIntoMovie(movie, omdbData) {
  const d = omdbData || {};
  if (!movie || typeof movie !== 'object') return movie;

  const ratings = Array.isArray(d?.Ratings) ? d.Ratings : [];
  const imdbRating = d?.imdbRating && d.imdbRating !== 'N/A' ? d.imdbRating : '';
  const metascore = d?.Metascore && d.Metascore !== 'N/A' ? d.Metascore : '';

  const merged = {
    ...movie,
    omdb: {
      imdbRating,
      imdbVotes: d?.imdbVotes && d.imdbVotes !== 'N/A' ? d.imdbVotes : '',
      metascore,
      ratings,
      awards: d?.Awards && d.Awards !== 'N/A' ? d.Awards : '',
      boxOffice: d?.BoxOffice && d.BoxOffice !== 'N/A' ? d.BoxOffice : '',
      dvd: d?.DVD && d.DVD !== 'N/A' ? d.DVD : '',
      production: d?.Production && d.Production !== 'N/A' ? d.Production : '',
    },
  };

  // If TMDB overview is empty, take OMDb plot.
  if (!String(merged.overview || '').trim() && String(d?.Plot || '').trim() && d.Plot !== 'N/A') {
    merged.overview = d.Plot;
  }
  // If runtime missing, take OMDb runtime.
  if (!merged.runtimeMin && String(d?.Runtime || '').includes('min')) {
    const m = String(d.Runtime).match(/(\d+)\s*min/i);
    if (m) merged.runtimeMin = Number(m[1]);
  }

  return merged;
}

function buildMovieReportMarkdown(movie, { languageHint, includeImages = true } = {}) {
  const lang = _reportLang(languageHint);
  const m = movie || {};

  const isTv = String(m.mediaType || '').toLowerCase() === 'tv';

  const title = m.title || '';
  const year = m.year || '';
  const original = m.originalTitle && m.originalTitle !== title ? m.originalTitle : '';
  const runtime = m.runtimeMin ? `${m.runtimeMin} min` : '';
  const genres = (m.genres || []).join(', ');
  const creators = (m.people?.creators || []).join(', ');
  const directors = (m.people?.directors || []).join(', ');
  const writers = (m.people?.writers || []).join(', ');
  const castTop = Array.isArray(m.people?.castTop) ? m.people.castTop : [];

  const imdbRating = m.omdb?.imdbRating || '';
  const meta = m.omdb?.metascore || '';
  const tmdbRating = m.tmdb?.voteAverage != null ? Number(m.tmdb.voteAverage).toFixed(1) : '';
  const tmdbVotes = m.tmdb?.voteCount != null ? String(m.tmdb.voteCount) : '';
  const age = m.ageRating || '';

  const poster = m.images?.poster_w500 || m.images?.poster_w342 || '';
  const backdrop = m.images?.backdrop_w1280 || m.images?.backdrop_w780 || '';

  const lines = [];
  if (includeImages) {
    if (poster) lines.push(`![Poster](${poster})`);
    if (backdrop) lines.push(`![Backdrop](${backdrop})`);
    if (poster || backdrop) lines.push('');
  }

  if (lang === 'hr') {
    lines.push(`${isTv ? '📺' : '🎬'} **${title}${year ? ` (${year})` : ''}**`);
    if (original) lines.push(`*Originalni naslov:* ${original}`);
    lines.push('');

    const bullets = [];
    if (isTv) {
      if (m.firstAirDate || m.releaseDate) bullets.push(`**Prvo emitiranje:** ${m.firstAirDate || m.releaseDate}`);
      if (m.lastAirDate) bullets.push(`**Zadnje emitiranje:** ${m.lastAirDate}`);
      if (m.numberOfSeasons != null) bullets.push(`**Broj sezona:** ${m.numberOfSeasons}`);
      if (m.numberOfEpisodes != null) bullets.push(`**Broj epizoda:** ${m.numberOfEpisodes}`);
      if (runtime) bullets.push(`**Trajanje epizode:** ${runtime}`);
    } else {
      if (m.releaseDate) bullets.push(`**Datum izlaska:** ${m.releaseDate}`);
      if (runtime) bullets.push(`**Trajanje:** ${runtime}`);
    }
    if (genres) bullets.push(`**Žanr:** ${genres}`);
    if (age) bullets.push(`**Dobna oznaka:** ${age}`);
    if (isTv) {
      if (creators) bullets.push(`**Kreator:** ${creators}`);
      else if (directors) bullets.push(`**Redatelj:** ${directors}`);
    } else if (directors) {
      bullets.push(`**Redatelj:** ${directors}`);
    }
    if (writers) bullets.push(`**Scenarij:** ${writers}`);
    if (m.countries?.length) bullets.push(`**Produkcija:** ${(m.countries || []).join(', ')}`);

    if (bullets.length) {
      lines.push('### 📌 Osnovno');
      bullets.forEach((b) => lines.push(`- ${b}`));
      lines.push('');
    }

    if (m.tagline) {
      lines.push('### 💬 Tagline');
      lines.push(`> ${m.tagline}`);
      lines.push('');
    }

    if (m.overview) {
      lines.push('### 📖 Kratki sadržaj');
      lines.push(m.overview);
      lines.push('');
    }

    if (castTop.length) {
      lines.push('### 🎭 Glumačka postava (top)');
      castTop.slice(0, 12).forEach((c) => {
        const role = c.character ? ` — ${c.character}` : '';
        lines.push(`- ${c.name}${role}`);
      });
      lines.push('');
    }

    const ratingBits = [];
    if (imdbRating) ratingBits.push(`IMDb: **${imdbRating}/10**`);
    if (meta) ratingBits.push(`Metascore: **${meta}/100**`);
    if (tmdbRating) ratingBits.push(`TMDB: **${tmdbRating}/10**${tmdbVotes ? ` (glasova: ${tmdbVotes})` : ''}`);
    if (ratingBits.length) {
      lines.push('### ⭐ Ocjene');
      lines.push(ratingBits.map((x) => `- ${x}`).join('\n'));
      lines.push('');
    }

    if (Array.isArray(m.trailers) && m.trailers.length) {
      lines.push('### ▶️ Trailer (YouTube)');
      m.trailers.slice(0, 3).forEach((t) => {
        lines.push(`- ${t.name || t.type || 'Trailer'}: ${t.url}`);
      });
      lines.push('');
    }

    const links = [];
    if (m.links?.imdb) links.push(`IMDb: ${m.links.imdb}`);
    if (m.links?.tmdb) links.push(`TMDB: ${m.links.tmdb}`);
    if (links.length) {
      lines.push('### 🔗 Linkovi');
      links.forEach((l) => lines.push(`- ${l}`));
      lines.push('');
    }

    lines.push('_Izvori podataka: TMDB (primarno) + OMDb (fallback/ocjene)._');
  } else {
    lines.push(`${isTv ? '📺' : '🎬'} **${title}${year ? ` (${year})` : ''}**`);
    if (original) lines.push(`*Original title:* ${original}`);
    lines.push('');

    const bullets = [];
    if (isTv) {
      if (m.firstAirDate || m.releaseDate) bullets.push(`**First air date:** ${m.firstAirDate || m.releaseDate}`);
      if (m.lastAirDate) bullets.push(`**Last air date:** ${m.lastAirDate}`);
      if (m.numberOfSeasons != null) bullets.push(`**Seasons:** ${m.numberOfSeasons}`);
      if (m.numberOfEpisodes != null) bullets.push(`**Episodes:** ${m.numberOfEpisodes}`);
      if (runtime) bullets.push(`**Episode runtime:** ${runtime}`);
    } else {
      if (m.releaseDate) bullets.push(`**Release date:** ${m.releaseDate}`);
      if (runtime) bullets.push(`**Runtime:** ${runtime}`);
    }
    if (genres) bullets.push(`**Genres:** ${genres}`);
    if (age) bullets.push(`**Age rating:** ${age}`);
    if (isTv) {
      if (creators) bullets.push(`**Creator:** ${creators}`);
      else if (directors) bullets.push(`**Director:** ${directors}`);
    } else if (directors) {
      bullets.push(`**Director:** ${directors}`);
    }
    if (writers) bullets.push(`**Writers:** ${writers}`);
    if (m.countries?.length) bullets.push(`**Production countries:** ${(m.countries || []).join(', ')}`);

    if (bullets.length) {
      lines.push('### Basics');
      bullets.forEach((b) => lines.push(`- ${b}`));
      lines.push('');
    }

    if (m.tagline) {
      lines.push('### Tagline');
      lines.push(`> ${m.tagline}`);
      lines.push('');
    }

    if (m.overview) {
      lines.push('### Plot');
      lines.push(m.overview);
      lines.push('');
    }

    if (castTop.length) {
      lines.push('### Cast (top)');
      castTop.slice(0, 12).forEach((c) => {
        const role = c.character ? ` — ${c.character}` : '';
        lines.push(`- ${c.name}${role}`);
      });
      lines.push('');
    }

    const ratingBits = [];
    if (imdbRating) ratingBits.push(`IMDb: **${imdbRating}/10**`);
    if (meta) ratingBits.push(`Metascore: **${meta}/100**`);
    if (tmdbRating) ratingBits.push(`TMDB: **${tmdbRating}/10**${tmdbVotes ? ` (votes: ${tmdbVotes})` : ''}`);
    if (ratingBits.length) {
      lines.push('### Ratings');
      lines.push(ratingBits.map((x) => `- ${x}`).join('\n'));
      lines.push('');
    }

    if (Array.isArray(m.trailers) && m.trailers.length) {
      lines.push('### Trailer (YouTube)');
      m.trailers.slice(0, 3).forEach((t) => {
        lines.push(`- ${t.name || t.type || 'Trailer'}: ${t.url}`);
      });
      lines.push('');
    }

    const links = [];
    if (m.links?.imdb) links.push(`IMDb: ${m.links.imdb}`);
    if (m.links?.tmdb) links.push(`TMDB: ${m.links.tmdb}`);
    if (links.length) {
      lines.push('### Links');
      links.forEach((l) => lines.push(`- ${l}`));
      lines.push('');
    }

    lines.push('_Data sources: TMDB (primary) + OMDb (fallback/ratings)._');
  }

  return lines.join('\n').trim();
}

function _looksLikeTvQuery(text) {
  const q = String(text || '').toLowerCase();
  if (!q) return false;
  const hints = [
    'serija',
    'tv',
    'sezona',
    'epizod',
    'season',
    'episode',
    'mini serija',
    'miniseries',
    'sitcom',
  ];
  return hints.some((h) => q.includes(h));
}

async function movieReport({ query, year, tmdbId, imdbId, languageHint, includeImages = true } = {}) {
  // Priority: TMDB (movie/tv) as primary + OMDb as fallback/ratings
  let q = String(query || '').trim();
  let y = year != null && !Number.isNaN(Number(year)) ? Number(year) : undefined;

  console.log(`🎬 [MOVIES] Request: query="${q}", year=${y}, tmdbId=${tmdbId}, imdbId=${imdbId}`);
  console.log(`🎬 [MOVIES] Auth: TMDB=${_hasTmdbAuth() ? 'YES' : 'NO'}, OMDB=${Boolean(OMDB_API_KEY) ? 'YES' : 'NO'}`);

  // If user typed a year inside the query and year param isn't provided, pick it up.
  if (!y && q) {
    const m = q.match(/\b(19\d{2}|20\d{2})\b/);
    if (m) y = Number(m[1]);
  }

  let preferTv = _looksLikeTvQuery(q);

  let pickedTmdbId = tmdbId ? Number(tmdbId) : null;
  let pickedImdb = String(imdbId || '').trim();
  let providerUsed = [];

  // 1) TMDB by explicit tmdbId (try movie+tv)
  let tmdb = null;
  if (pickedTmdbId && _hasTmdbAuth()) {
    const order = preferTv ? ['tv', 'movie'] : ['movie', 'tv'];
    for (const kind of order) {
      if (kind === 'movie') {
        tmdb = await tmdbGetMovieFull(pickedTmdbId, { languageHint, includeImages }).catch((e) => ({ ok: false, error: e.message }));
      } else {
        tmdb = await tmdbGetTvFull(pickedTmdbId, { languageHint, includeImages }).catch((e) => ({ ok: false, error: e.message }));
      }
      if (tmdb?.ok && tmdb.movie) {
        providerUsed.push('tmdb');
        break;
      }
    }
  }

  // 2) TMDB via /find by IMDb id (if provided) — supports both movie and tv
  if ((!tmdb || !tmdb.ok || !tmdb.movie) && pickedImdb && _hasTmdbAuth()) {
    const f = await tmdbFindByImdb(pickedImdb, { languageHint }).catch((e) => ({ ok: false, error: e.message }));
    if (f?.ok && (f.movieTmdbId || f.tvTmdbId)) {
      providerUsed.push('tmdb_find');
      const candidates = [];
      if (preferTv) {
        if (f.tvTmdbId) candidates.push({ kind: 'tv', id: Number(f.tvTmdbId) || null });
        if (f.movieTmdbId) candidates.push({ kind: 'movie', id: Number(f.movieTmdbId) || null });
      } else {
        if (f.movieTmdbId) candidates.push({ kind: 'movie', id: Number(f.movieTmdbId) || null });
        if (f.tvTmdbId) candidates.push({ kind: 'tv', id: Number(f.tvTmdbId) || null });
      }

      for (const c of candidates) {
        if (!c.id) continue;
        pickedTmdbId = c.id;
        if (c.kind === 'movie') {
          tmdb = await tmdbGetMovieFull(c.id, { languageHint, includeImages }).catch((e) => ({ ok: false, error: e.message }));
        } else {
          tmdb = await tmdbGetTvFull(c.id, { languageHint, includeImages }).catch((e) => ({ ok: false, error: e.message }));
        }
        if (tmdb?.ok && tmdb.movie) {
          providerUsed.push('tmdb');
          break;
        }
      }
    }
  }

  // 3) TMDB search by query (movie + tv)
  if ((!tmdb || !tmdb.ok || !tmdb.movie) && q && _hasTmdbAuth()) {
    const order = preferTv ? ['tv', 'movie'] : ['movie', 'tv'];
    for (const kind of order) {
      const s = (kind === 'movie')
        ? await tmdbSearchMovie(q, { year: y, languageHint, maxResults: 6 }).catch((e) => ({ ok: false, error: e.message }))
        : await tmdbSearchTv(q, { year: y, languageHint, maxResults: 6 }).catch((e) => ({ ok: false, error: e.message }));

      if (s?.ok && Array.isArray(s.results) && s.results.length) {
        providerUsed.push(kind === 'movie' ? 'tmdb_search_movie' : 'tmdb_search_tv');
        pickedTmdbId = Number(s.results[0].tmdbId) || null;
        if (pickedTmdbId) {
          tmdb = (kind === 'movie')
            ? await tmdbGetMovieFull(pickedTmdbId, { languageHint, includeImages }).catch((e) => ({ ok: false, error: e.message }))
            : await tmdbGetTvFull(pickedTmdbId, { languageHint, includeImages }).catch((e) => ({ ok: false, error: e.message }));
          if (tmdb?.ok && tmdb.movie) {
            providerUsed.push('tmdb');
            break;
          }
        }
      }
    }
  }

  // Base movie/show (prefer TMDB)
  let baseMovie = tmdb?.ok && tmdb.movie ? tmdb.movie : null;

  // Determine imdbId for OMDb
  if (!pickedImdb && baseMovie?.imdbId) pickedImdb = String(baseMovie.imdbId || '').trim();

  // 4) OMDb (ratings + fallback)
  let omdb = null;
  if (OMDB_API_KEY) {
    if (pickedImdb) {
      omdb = await omdbByImdb(pickedImdb).catch((e) => ({ ok: false, error: e.message }));
      if (omdb?.ok) providerUsed.push('omdb');
    } else if (!baseMovie && q) {
      omdb = await omdbByTitle(q, { year: y }).catch((e) => ({ ok: false, error: e.message }));
      if (omdb?.ok) providerUsed.push('omdb');

      // If OMDb found it, try TMDB again via IMDb -> TMDB becomes primary.
      const imdbFromOmdb = omdb?.ok && omdb.data?.imdbID ? String(omdb.data.imdbID).trim() : '';
      const omdbType = String(omdb?.data?.Type || '').trim().toLowerCase();
      const omdbPreferTv = omdbType === 'series' || omdbType === 'episode';
      if (imdbFromOmdb && _hasTmdbAuth()) {
        const f = await tmdbFindByImdb(imdbFromOmdb, { languageHint }).catch((e) => ({ ok: false, error: e.message }));
        if (f?.ok && (f.movieTmdbId || f.tvTmdbId)) {
          providerUsed.push('tmdb_find');
          const candidates = [];
          if (omdbPreferTv) {
            if (f.tvTmdbId) candidates.push({ kind: 'tv', id: Number(f.tvTmdbId) || null });
            if (f.movieTmdbId) candidates.push({ kind: 'movie', id: Number(f.movieTmdbId) || null });
          } else {
            if (f.movieTmdbId) candidates.push({ kind: 'movie', id: Number(f.movieTmdbId) || null });
            if (f.tvTmdbId) candidates.push({ kind: 'tv', id: Number(f.tvTmdbId) || null });
          }

          for (const c of candidates) {
            if (!c.id) continue;
            const t = (c.kind === 'movie')
              ? await tmdbGetMovieFull(c.id, { languageHint, includeImages }).catch((e) => ({ ok: false, error: e.message }))
              : await tmdbGetTvFull(c.id, { languageHint, includeImages }).catch((e) => ({ ok: false, error: e.message }));

            if (t?.ok && t.movie) {
              baseMovie = t.movie;
              providerUsed.push('tmdb');
              // Prefer TMDB imdbId going forward
              if (!pickedImdb && baseMovie?.imdbId) pickedImdb = String(baseMovie.imdbId || '').trim();
              break;
            }
          }
        }
      }
    }
  }

  // If we only have OMDb but not TMDB, still normalize a movie/show object
  if (!baseMovie && omdb?.ok && omdb.data) {
    const d = omdb.data;
    const oType = String(d?.Type || '').trim().toLowerCase();
    const isTv = oType === 'series' || oType === 'episode';
    if (isTv) preferTv = true;

    baseMovie = {
      mediaType: isTv ? 'tv' : 'movie',
      tmdbId: null,
      imdbId: d.imdbID || '',
      title: d.Title || '',
      originalTitle: d.Title || '',
      tagline: '',
      overview: d.Plot && d.Plot !== 'N/A' ? d.Plot : '',
      year: d.Year || '',
      releaseDate: d.Released && d.Released !== 'N/A' ? d.Released : '',
      firstAirDate: isTv && d.Released && d.Released !== 'N/A' ? d.Released : '',
      lastAirDate: '',
      numberOfSeasons: isTv && d.totalSeasons ? Number(d.totalSeasons) : null,
      numberOfEpisodes: null,
      runtimeMin: (() => {
        const m = String(d.Runtime || '').match(/(\d+)\s*min/i);
        return m ? Number(m[1]) : null;
      })(),
      status: '',
      genres: String(d.Genre || '') && d.Genre !== 'N/A' ? String(d.Genre).split(',').map((x) => x.trim()).filter(Boolean) : [],
      countries: String(d.Country || '') && d.Country !== 'N/A' ? String(d.Country).split(',').map((x) => x.trim()).filter(Boolean) : [],
      spokenLanguages: String(d.Language || '') && d.Language !== 'N/A' ? String(d.Language).split(',').map((x) => x.trim()).filter(Boolean) : [],
      ageRating: d.Rated && d.Rated !== 'N/A' ? d.Rated : '',
      tmdb: { voteAverage: null, voteCount: null, popularity: null },
      people: {
        creators: [],
        directors: String(d.Director || '') && d.Director !== 'N/A' ? String(d.Director).split(',').map((x) => x.trim()).filter(Boolean) : [],
        writers: String(d.Writer || '') && d.Writer !== 'N/A' ? String(d.Writer).split(',').map((x) => x.trim()).filter(Boolean) : [],
        castTop: String(d.Actors || '') && d.Actors !== 'N/A'
          ? String(d.Actors).split(',').map((x) => ({ name: x.trim(), character: '', order: null })).filter((x) => x.name)
          : [],
      },
      images: {
        poster_w342: d.Poster && d.Poster !== 'N/A' ? d.Poster : '',
        poster_w500: d.Poster && d.Poster !== 'N/A' ? d.Poster : '',
        poster_original: d.Poster && d.Poster !== 'N/A' ? d.Poster : '',
        backdrop_w780: '',
        backdrop_w1280: '',
        backdrop_original: '',
      },
      links: {
        tmdb: '',
        imdb: d.imdbID ? `https://www.imdb.com/title/${d.imdbID}/` : '',
      },
      trailers: [],
      watchProviders: null,
      source: { provider: 'omdb', language: 'n/a' },
    };
  }

  // Merge OMDb details into base movie/show (ratings, plot, runtime)
  if (baseMovie && omdb?.ok && omdb.data) {
    baseMovie = _mergeOmdbIntoMovie(baseMovie, omdb.data);
    if (!baseMovie.mediaType) {
      const oType = String(omdb?.data?.Type || '').trim().toLowerCase();
      baseMovie.mediaType = (oType === 'series' || oType === 'episode') ? 'tv' : 'movie';
    }
  }


if (!baseMovie) {
  // If providers errored, surface the root cause (helps debugging in Cloud Run logs).
  const errs = [];
  if (tmdb && tmdb.ok === false && tmdb.error) errs.push(`TMDB: ${tmdb.error}`);
  if (omdb && omdb.ok === false && omdb.error) errs.push(`OMDb: ${omdb.error}`);

  const errorMsg = errs.length ? errs.join(' | ') : 'Movie/TV not found (TMDB/OMDb)';
  console.error(`❌ [MOVIES] Failed: ${errorMsg}`);
  console.error(`❌ [MOVIES] Providers tried: ${providerUsed.join(', ') || 'none'}`);

  return {
    ok: false,
    error: errorMsg,
    providerUsed: Array.from(new Set(providerUsed)),
  };
}

  const reportMarkdown = buildMovieReportMarkdown(baseMovie, { languageHint, includeImages });

  console.log(`✅ [MOVIES] Success: ${baseMovie.title} (${baseMovie.releaseYear || 'N/A'})`);
  console.log(`✅ [MOVIES] Providers used: ${providerUsed.join(', ')}`);

  return {
    ok: true,
    providerUsed: Array.from(new Set(providerUsed)),
    movie: baseMovie,
    reportMarkdown,
    images: {
      poster: baseMovie?.images?.poster_w500 || baseMovie?.images?.poster_w342 || '',
      backdrop: baseMovie?.images?.backdrop_w1280 || baseMovie?.images?.backdrop_w780 || '',
    },
  };
}

module.exports = {
  tmdbSearchMovie,
  tmdbSearchTv,
  tmdbGetMovieFull,
  tmdbGetTvFull,
  omdbByImdb,
  omdbByTitle,
  movieReport,
  buildMovieReportMarkdown,
};
