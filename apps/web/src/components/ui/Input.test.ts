/**
 * The Input must forward the value and the change handler to the native input.
 *
 * Input destructures `value` and `onChange` out of its props, so the rest
 * spread can never carry them: without an explicit pass-through the input is
 * uncontrolled and silent. That is not a cosmetic defect - react-hook-form's
 * `register` returns exactly these two props, so dropping them kills live
 * validation in every form, and a controlled field (a prefilled amount) never
 * shows what it holds.
 *
 * The value is proved by rendering the component. The change handler cannot be
 * proved without a DOM, which this runner does not have, so it is proved
 * against the source: the pass-through must exist on the input element.
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Input } from './Input';

describe('Input forwards value and onChange', () => {
  it('renders the value it is given', () => {
    const html = renderToStaticMarkup(
      createElement(Input, { label: 'Amount', value: '1200', onChange: () => undefined }),
    );
    expect(html).toContain('value="1200"');
  });

  it('renders no value attribute when the field is uncontrolled', () => {
    const html = renderToStaticMarkup(
      createElement(Input, { label: 'Amount', onChange: () => undefined }),
    );
    expect(html).not.toContain('value=');
  });

  it('passes the change handler to the native input', () => {
    const source = readFileSync(new URL('./Input.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/\n\s*value=\{value\}/);
    expect(source).toMatch(/\n\s*onChange=\{onChange\}/);
  });
});
