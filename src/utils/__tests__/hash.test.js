import { computeSHA256 } from '../hash';

test('computeSHA256 for string "hello"', async () => {
  const hex = await computeSHA256('hello');
  // known sha256('hello')
  expect(hex).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
});

