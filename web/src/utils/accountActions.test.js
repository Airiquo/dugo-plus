import test from "node:test";
import assert from "node:assert/strict";
import { accountActionReasons, accountProfileEditReason } from "./accountActions.js";
const account = { id: "donor", role: "donor", status: "Active" };
test('profile editing is available for live donor/hospital accounts and explains protected states', () => {
  assert.equal(accountProfileEditReason(account, 'admin'), '')
  assert.equal(accountProfileEditReason({ ...account, status: 'Suspended', role: 'hospital' }, 'admin'), '')
  for (const update of [{ status: 'Removed' }, { personalDataErased: true }, { role: 'admin' },
    { loginState: 'Deleted' }, { loginState: 'Deleting' }, { loginState: 'Provisioning' }])
    assert.ok(accountProfileEditReason({ ...account, ...update }, 'admin'))
  assert.ok(accountProfileEditReason(account, 'donor'))
})
test("active, suspended and removed accounts expose the correct action set", () => {
  assert.equal(accountActionReasons(account, "admin").suspend, "");
  assert.ok(accountActionReasons(account, "admin").restore);
  const suspended = accountActionReasons(
    { ...account, status: "Suspended" },
    "admin",
  );
  assert.equal(suspended.restore, "");
  assert.equal(suspended.remove, "");
  assert.ok(suspended.delete);
  assert.equal(
    accountActionReasons({ ...account, status: "Removed" }, "admin").delete,
    "",
  );
});
test("self, protected roles, erasure and unavailable login states disable every mutation", () => {
  for (const row of [
    { ...account, id: "admin" },
    { ...account, role: "admin" },
    { ...account, role: null },
    { ...account, personalDataErased: true },
    { ...account, loginDeletedAt: new Date() },
    ...["Deleted", "Deleting", "Provisioning"].map((loginState) => ({
      ...account,
      loginState,
    })),
  ])
    assert.ok(Object.values(accountActionReasons(row, "admin")).every(Boolean));
  assert.ok(
    Object.values(accountActionReasons(account, "admin", true)).every(Boolean),
  );
});
