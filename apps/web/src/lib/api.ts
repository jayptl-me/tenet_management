import ky from 'ky';
import { useApiLoadingStore } from '@/store/apiLoading';
import { useAuthStore } from '@/store/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

const rawApi = ky.create({
  prefixUrl: API_BASE_URL,
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window !== 'undefined') {
          let token: string | null = null;
          try {
            const raw = localStorage.getItem('pg-auth-storage');
            if (raw) {
              const parsed = JSON.parse(raw);
              token = parsed?.state?.accessToken ?? null;
            }
          } catch {
            // localStorage not available
          }
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
          }
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401 && typeof window !== 'undefined') {
          // Avoid infinite loop on auth endpoints
          if (_request.url.includes('/auth/')) return response;

          let refreshToken: string | null = null;
          try {
            const raw = localStorage.getItem('pg-auth-storage');
            if (raw) {
              const parsed = JSON.parse(raw);
              refreshToken = parsed?.state?.refreshToken ?? null;
            }
          } catch {
            // localStorage not available
          }

          if (refreshToken) {
            try {
              const refreshResponse = await ky
                .post(`${API_BASE_URL}/auth/refresh`, {
                  json: { refreshToken },
                })
                .json<{
                  success: boolean;
                  data: { accessToken: string; refreshToken: string };
                }>();

              const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;

              // Update Zustand store (also persists to localStorage via middleware)
              useAuthStore.getState().setTokens(accessToken, newRefreshToken);

              // Retry original request with new token
              const newRequest = new Request(_request);
              newRequest.headers.set('Authorization', `Bearer ${accessToken}`);
              return ky(newRequest);
            } catch {
              localStorage.removeItem('pg-auth-storage');
              window.location.href = '/login';
            }
          }
        }
        return response;
      },
    ],
  },
});

// Track active requests for loading state
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
