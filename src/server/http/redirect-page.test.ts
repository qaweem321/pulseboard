import { redirectPage } from "./redirect-page";

test("redirect pages replace history and can't be broken out of", async () => {
  const response = redirectPage('/dashboard?q=</script><script>alert("x")</script>&a=1');
  const html = await response.text();
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(html).toContain(
    'location.replace("/dashboard?q=\\u003c/script>\\u003cscript>alert(\\"x\\")\\u003c/script>&a=1")',
  );
  expect(html).toContain(
    'content="0;url=/dashboard?q=&lt;/script>&lt;script>alert(&quot;x&quot;)&lt;/script>&amp;a=1"',
  );
  expect(html.match(/<script>/g)).toHaveLength(1);
});
