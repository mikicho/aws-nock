import { readdir } from 'node:fs/promises'

const srcFiles = await readdir(new URL('./src', import.meta.url))

export default {
  input: srcFiles.filter((file) => file.endsWith('.js')).map((x) => `src/${x}`),
  output: {
    dir: 'cjs',
    format: 'cjs',
    entryFileNames: '[name].cjs',
    preserveModules: true,
  },
  external: ['nock', 'node:crypto'],
}
