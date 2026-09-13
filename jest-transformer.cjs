const esbuild = require(require.resolve('esbuild', { paths: [require.resolve('tsx')] }));

module.exports = {
  process(sourceText, sourcePath) {
    const isTs = sourcePath.endsWith('.ts') || sourcePath.endsWith('.tsx');
    const result = esbuild.transformSync(sourceText, {
      loader: isTs ? 'ts' : 'js',
      format: 'cjs',
      target: 'es2022',
      sourcemap: 'inline',
      sourcefile: sourcePath,
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
        },
      },
    });
    return {
      code: result.code,
      map: result.map,
    };
  },
};
