import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export async function resolve(specifier, context, defaultResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const parentPath = fileURLToPath(context.parentURL);
    const parentDir = path.dirname(parentPath);
    const resolvedPath = path.resolve(parentDir, specifier);

    if (specifier.endsWith('.js')) {
      const tsPath = resolvedPath.replace(/\.js$/, '.ts');
      if (existsSync(tsPath)) {
        return { url: pathToFileURL(tsPath).href, shortCircuit: true };
      }
    }

    if (!path.extname(specifier)) {
      const tsPath = `${resolvedPath}.ts`;
      if (existsSync(tsPath)) {
        return { url: pathToFileURL(tsPath).href, shortCircuit: true };
      }
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
