import TestClient from './test_client.ts';

const session = '90944423.8eeaa312e9d4762dfbaca57ec768af3ee7bf0262435210';
const username = 'jefvel';

const timeout = (ms = 0) =>
  new Promise(r => {
    setTimeout(r, ms);
  });

if (import.meta.main) {
  const _c1 = new TestClient(username, session);
  const _c2 = new TestClient('user 2', '111112');
  const c3 = new TestClient('user 3', '111113');
  const c4 = new TestClient('user 4', '111114');

  await timeout(400);

  c4.move_to(100, 123);

  await timeout(200);

  c3.switch_room(2);

  await timeout(200);

  c3.switch_room(2);

  await timeout(10000);
  c3.switch_room(1);
}
