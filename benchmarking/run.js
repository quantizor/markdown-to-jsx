import BenchTable from 'benchtable';
import * as fs from 'fs';
import ReactMarkdown from 'react-markdown';
import SimpleMarkdown from 'simple-markdown';
import MarkdownIt from 'markdown-it';
import { compiler } from './';

const mdIt = new MarkdownIt();
const suite = new BenchTable();

const fixture = fs.readFileSync('./fixture.md', 'utf8');

// add tests
suite
  .addFunction('markdown-to-jsx', input => compiler(input))
  .addFunction('react-markdown', input => new ReactMarkdown({ source: input }))
  .addFunction('simple-markdown', input =>
    SimpleMarkdown.defaultReactOutput(SimpleMarkdown.defaultBlockParse(input))
  )
  .addFunction('markdown-it', input => mdIt.render(input))
  .addInput('simple markdown string', ['_Hello_ **world**!'])
  .addInput('large markdown string', [fixture])
  .on('complete', function() {
    console.log('Fastest is ' + suite.filter('fastest').map('name'));
    console.log(suite.table.toString());
  })
  // run async
  .run({ async: true });
