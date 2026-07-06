import ky from 'ky';
import { useApiLoadingStore } from '@/store/apiLoading';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

const rawApi = ky.create({
  prefixUrl: API_BASE_URL,
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window !== 'undefined') {
          // Read from Zustand persist storage (pg-auth-storage key in localStorage)
          let token: string | null = null;
          try {
            const raw = localStorage.getItem('pg-auth-storage');
            if (raw) {
              const parsed = JSON.parse(raw);
              token = parsed?.state?.accessToken ?? null;
            }
          } catch {}
          // Fallback to direct key
          if (!token) token = localStorage.getItem('accessToken');
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
          }
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401 && typeof window !== 'undefined') {
          let refreshToken: string | null = null;
          try {
            const raw = localStorage.getItem('pg-auth-storage');
            if (raw) {
              const parsed = JSON.parse(raw);
              refreshToken = parsed?.state?.refreshToken ?? null;
            }
          } catch {}
          if (!refreshToken) refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken && !_request.url.includes('/auth/')) {
            try {
              const refreshResponse = await ky
                .post(`${API_BASE_URL}/auth/refresh`, {
                  json: { refreshToken },
                })
                .json<{ accessToken: string; refreshToken: string }>();

              localStorage.setItem('accessToken', refreshResponse.accessToken);
              localStorage.setItem('refreshToken', refreshResponse.refreshToken);

              _request.headers.set('Authorization', `Bearer ${refreshResponse.accessToken}`);
              return ky(_request);
            } catch {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              window.location.href = '/login';
            }
          }
        }
        return response;
      },
    ],
  },
});

// Intercept promise resolution to decrement active requests counter
const wrapResponsePromise = <T>(promise: Promise<T>): Promise<T> => {
  let decremented = false;
  const decrement = () => {
    if (typeof window !== 'undefined' && !decremented) {
      decremented = true;
      useApiLoadingStore.getState().decrementRequests();
    }
  };

  return new Proxy(promise, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          if (prop === 'then') {
            const [onfulfilled, onrejected] = args as [
              ((res: T) => unknown) | undefined,
              ((err: unknown) => unknown) | undefined,
            ];
            return value.call(
              target,
              onfulfilled
                ? (res: T) => {
                    decrement();
                    return onfulfilled(res);
                  }
                : undefined,
              onrejected
                ? (err: unknown) => {
                    decrement();
                    return onrejected(err);
                  }
                : (err: unknown) => {
                    decrement();
                    throw err;
                  },
            );
          }
          if (prop === 'catch') {
            const [onrejected] = args as [((err: unknown) => unknown) | undefined];
            return value.call(target, (err: unknown) => {
              decrement();
              return onrejected ? onrejected(err) : undefined;
            });
          }
          if (prop === 'finally') {
            const [onfinally] = args as [(() => void) | undefined];
            return value.call(target, () => {
              decrement();
              if (onfinally) onfinally();
            });
          }

          // Handle response helper methods like .json(), .text(), etc.
          const result = value.apply(target, args);
          if (result instanceof Promise) {
            return result.then(
              (val: unknown) => {
                decrement();
                return val;
              },
              (err: unknown) => {
                decrement();
                throw err;
              },
            );
          }
          return result;
        };
      }
      return value;
    },
  }) as Promise<T>;
};

// Wrap kyInstance to track the request lifecycle
const wrapKy = (instance: typeof rawApi) => {
  const handler: ProxyHandler<typeof rawApi> = {
    apply(target, thisArg, argArray) {
      if (typeof window !== 'undefined') {
        useApiLoadingStore.getState().incrementRequests();
      }
      return wrapResponsePromise(
        (target as (...args: unknown[]) => unknown).apply(thisArg, argArray) as Promise<unknown>,
      );
    },
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (
        typeof value === 'function' &&
        ['get', 'post', 'put', 'delete', 'patch', 'head'].includes(String(prop))
      ) {
        return (...args: unknown[]) => {
          if (typeof window !== 'undefined') {
            useApiLoadingStore.getState().incrementRequests();
          }
          return wrapResponsePromise(
            (value as (...args: unknown[]) => unknown).apply(target, args) as Promise<unknown>,
          );
        };
      }
      return value;
    },
  };
  return new Proxy(instance, handler);
};

export const api = wrapKy(rawApi) as typeof rawApi;
