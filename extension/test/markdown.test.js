import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown as md } from '../src/ui/markdown.js';

test('blocks: headings, paragraphs, lists, quotes, rules, code', () => {
  assert.equal(md('## Verdict'), '<h4>Verdict</h4>');
  assert.equal(md('one\ntwo\n\nthree'), '<p>one<br>two</p><p>three</p>');
  assert.equal(md('- a\n- **b**'), '<ul><li>a</li><li><strong>b</strong></li></ul>');
  assert.equal(md('1. first\n2. second'), '<ol><li>first</li><li>second</li></ol>');
  assert.equal(md('- parent\n  - child'), '<ul><li>parent<ul><li>child</li></ul></li></ul>');
  assert.equal(md('> careful'), '<blockquote>careful</blockquote>');
  assert.equal(md('---'), '<hr>');
  assert.equal(md('```\nx < 1\n```'), '<pre><code>x &lt; 1</code></pre>');
});

test('inline: bold, italic, code, strike, links', () => {
  assert.equal(md('**$852,500** likely, *not* asking'), '<p><strong>$852,500</strong> likely, <em>not</em> asking</p>');
  assert.equal(md('use `get_listing_brief`'), '<p>use <code>get_listing_brief</code></p>');
  assert.equal(md('~~old~~ new'), '<p><del>old</del> new</p>');
  assert.equal(md('[REA](https://www.realestate.com.au/x)'), '<p><a href="https://www.realestate.com.au/x" target="_blank" rel="noopener noreferrer">REA</a></p>');
  assert.equal(md('5 * 3 * 2 = 30'), '<p>5 * 3 * 2 = 30</p>'); // lone asterisks are not italics
  assert.equal(md('snake_case_name'), '<p>snake_case_name</p>');
});

test('tables', () => {
  assert.equal(
    md('| Metric | Value |\n|---|---|\n| Rent | **$775/wk** |\n| Yield | 4.73% |'),
    '<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody><tr><td>Rent</td><td><strong>$775/wk</strong></td></tr><tr><td>Yield</td><td>4.73%</td></tr></tbody></table>',
  );
});

test('safe: raw HTML is escaped, only http(s) links become anchors', () => {
  assert.equal(md('<img src=x onerror=alert(1)>'), '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  assert.equal(md('[x](javascript:alert(1))'), '<p>[x](javascript:alert(1))</p>');
  assert.ok(!md('[a](https://e.com" onclick="x)').includes('onclick="'));
  assert.equal(md('**<b>hi</b>**'), '<p><strong>&lt;b&gt;hi&lt;/b&gt;</strong></p>');
});
