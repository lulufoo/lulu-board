import { readFile } from 'node:fs/promises';
import jison from 'jison';

const Generator = jison.Generator ?? jison.default?.Generator;

export const jisonPlugin = {
  name: 'jison',
  setup(build) {
    build.onLoad({ filter: /\.jison$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      const parser = new Generator(source, { moduleType: 'js', 'token-stack': true });
      const body = parser.generate({ moduleMain: '() => {}' });
      const exporter = `
	parser.parser = parser;
	export { parser };
	export default parser;
	`;
      return { contents: `${body} ${exporter}`, loader: 'js' };
    });
  },
};
