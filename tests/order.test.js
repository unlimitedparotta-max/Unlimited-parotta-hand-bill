const { test } = require('node:test');
const assert = require('node:assert');
const { resolveCartItems } = require('../services/orderService');

const fakeDb = {
  menus: {
    unlimited: [
      { cat: 'Parotta', items: [{ id: 'p1', name: 'Unlimited Parotta', price: 99, image: null }] }
    ]
  }
};

test('resolveCartItems prices items from the menu, ignoring any price sent by the client', () => {
  const items = resolveCartItems(fakeDb, 'unlimited', [{ id: 'p1', qty: 2, price: 1 }]);
  assert.strictEqual(items[0].price, 99); // server price wins, not the client's "1"
  assert.strictEqual(items[0].qty, 2);
});

test('resolveCartItems rejects an unknown item id', () => {
  assert.throws(() => resolveCartItems(fakeDb, 'unlimited', [{ id: 'does-not-exist', qty: 1 }]));
});

test('resolveCartItems rejects an invalid quantity', () => {
  assert.throws(() => resolveCartItems(fakeDb, 'unlimited', [{ id: 'p1', qty: 0 }]));
  assert.throws(() => resolveCartItems(fakeDb, 'unlimited', [{ id: 'p1', qty: -1 }]));
});

test('resolveCartItems rejects an unknown menu key', () => {
  assert.throws(() => resolveCartItems(fakeDb, 'nonexistent-menu', [{ id: 'p1', qty: 1 }]));
});
