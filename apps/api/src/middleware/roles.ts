import type { MiddlewareHandler } from 'hono';

export const adminOnly: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');
  if (user?.role !== 'admin') {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required.',
        },
      },
      403,
    );
  }
  await next();
};

export const tenantOnly: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');
  if (user?.role !== 'tenant') {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Tenant access required.',
        },
      },
      403,
    );
  }
  await next();
};

export const adminOrTenant: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');
  if (user?.role !== 'admin' && user?.role !== 'tenant') {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied.',
        },
      },
      403,
    );
  }
  await next();
};

/**
 * Allows access if the user is an admin OR if the user's ID matches the
 * target resource's owner. Pass the targetUserId extractor as a parameter.
 *
 * Usage: selfOrAdmin((c) => c.req.param('tenantId'))
 */
export function selfOrAdmin(
  getTargetUserId: (c: Parameters<MiddlewareHandler>[0]) => string | null,
): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');

    // Admin can access anything
    if (user?.role === 'admin') {
      return next();
    }

    const targetUserId = getTargetUserId(c);
    if (!targetUserId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. Could not determine resource owner.',
          },
        },
        403,
      );
    }

    if (user?.sub === targetUserId) {
      return next();
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. You can only access your own resources.',
        },
      },
      403,
    );
  };
}
