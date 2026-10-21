/* eslint-disable @typescript-eslint/no-require-imports -- Render the real form with controlled action states. */
const assert = require('node:assert/strict');
const Module = require('node:module');
require('tsx/cjs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const originalLoad = Module._load, originalHook = React.useActionState;
let state = {}, pending = false;
try {
  Module._load = function(request, parent, isMain) {
    if (request === '@/features/payroll/actions') return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  React.useActionState = () => [state, () => {}, pending];
  const { PayrollGenerationForm } = require('../src/components/payroll/PayrollSetupForms.tsx');
  const render = () => renderToStaticMarkup(React.createElement(PayrollGenerationForm, { periods: [{ id: 'fixture', name: 'Fixture period' }] }));
  state = { success: 'Previous generation complete' }; pending = true;
  let html = render();
  assert.ok(html.includes('aria-busy="true"') && html.includes('Payroll generation is in progress.'));
  assert.ok(!html.includes('Previous generation complete'));
  assert.match(html, /<select[^>]*disabled/);
  assert.match(html, /<button[^>]*disabled/);
  pending = false;
  html = render();
  assert.ok(html.includes('Previous generation complete') && !html.includes('Payroll generation is in progress.'));
  state = { error: 'Generation failed', setupErrors: [{ employeeNumber: 'FIXTURE', employeeName: 'Test', message: 'Missing compensation' }] };
  html = render();
  assert.ok(html.includes('Generation failed') && html.includes('Missing compensation') && html.includes('role="alert"'));
  console.log('UX Payroll: pending state replaces stale success; controls lock; returned success and errors remain visible.');
} finally {
  Module._load = originalLoad; React.useActionState = originalHook;
}
