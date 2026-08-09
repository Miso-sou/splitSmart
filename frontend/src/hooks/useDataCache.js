import { useState, useEffect, useRef } from 'react';

const cache = new Map();

export function prefetchData(key, fetcher) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));

  return fetcher()
    .then((result) => {
      const freshData = result?.data !== undefined ? result.data : result;
      cache.set(key, freshData);
      return freshData;
    })
    .catch(() => null);
}

export function getCachedData(key) {
  return cache.get(key);
}

export function setCachedData(key, value) {
  cache.set(key, value);
}

export function useDataCache(key, fetcher, deps = []) {
  const [data, setData] = useState(() => cache.get(key) || null);
  const [loading, setLoading] = useState(() => !cache.has(key));
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let isActive = true;
    const cachedData = cache.get(key);

    if (cachedData !== undefined) {
      setData(cachedData);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetcherRef.current()
      .then((result) => {
        if (!isActive) return;
        const freshData = result?.data !== undefined ? result.data : result;
        cache.set(key, freshData);
        setData(freshData);
        setError(null);
      })
      .catch((err) => {
        if (!isActive) return;
        if (!cache.has(key)) {
          setError(err.response?.data?.message || err.message || 'Failed to load data');
        }
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [key, ...deps]);

  const invalidateCache = () => {
    cache.delete(key);
  };

  return { data, loading, error, invalidateCache, setData };
}

export function clearDataCache(key) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

