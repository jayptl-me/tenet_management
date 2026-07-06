/**
 * Mongoose mock plugin — registered via bunfig preload.
 * Intercepts `import ... from 'mongoose'` and redirects to in-memory mock.
 */
import { plugin } from 'bun';

plugin({
  name: 'mongoose-mock',
  setup(build) {
    // Intercept bare 'mongoose' imports
    build.onResolve({ filter: /^mongoose$/ }, (args) => {
      const mockPath = `${import.meta.dir}/mongoose.ts`;
      return { path: mockPath, namespace: 'file' };
    });
  },
});
