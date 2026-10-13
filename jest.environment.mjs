import JSDOMEnvironment from "jest-environment-jsdom";

// jsdom has no Fetch API. Borrow Node's, so RTK Query runs in component tests as in the browser.
const NODE_GLOBALS = [
  "fetch",
  "Request",
  "Response",
  "Headers",
  "FormData",
  "Blob",
  "ReadableStream",
  "TextEncoder",
  "TextDecoder",
  "AbortController",
  "AbortSignal",
  "structuredClone",
];

export default class DomWithFetchEnvironment extends JSDOMEnvironment {
  constructor(...args) {
    super(...args);
    for (const name of NODE_GLOBALS) this.global[name] = globalThis[name];
  }
}
