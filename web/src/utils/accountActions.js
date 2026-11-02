/** Empty reason means enabled; every other value explains the disabled action. */
export function accountActionReasons(account, actorId, busy = false) {
  const all = (reason) => ({
    suspend: reason,
    remove: reason,
    restore: reason,
    delete: reason,
  });
  if (busy) return all("Another account change is in progress.");
  if (account.id === actorId)
    return all("You cannot change your own account access.");
  if (!["donor", "hospital"].includes(account.role))
    return all("Administrator and unknown account types are protected.");
  if (account.personalDataErased)
    return all("Personal data was erased. Access cannot be restored.");
  if (["Deleting", "Provisioning"].includes(account.loginState))
    return all(
      "Sign-in setup or deletion is still processing. Refresh before making another change.",
    );
  if (account.loginState === "Deleted" || account.loginDeletedAt)
    return all("The sign-in was permanently deleted.");
  const status = account.status || "Active";
  if (!["Active", "Suspended", "Removed"].includes(status))
    return all("This account has an unsupported access state.");
  return {
    suspend:
      status === "Active" ? "" : "Only an active account can be suspended.",
    remove: status !== "Removed" ? "" : "Access has already been removed.",
    restore:
      status !== "Active" ? "" : "This account already has active access.",
    delete:
      status === "Removed"
        ? ""
        : "Remove account access before permanently deleting its sign-in.",
  };
}
