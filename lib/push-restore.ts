// A transient server failure is not evidence that browser permission or the
// push subscription was removed. Never request permission during restoration.
export async function restorePushDevice<T>(permission: NotificationPermission, getSubscription: () => Promise<T | null>, register: (value: T) => Promise<void>): Promise<"enabled" | "disabled"> {
  if (permission !== "granted") return "disabled";
  const subscription = await getSubscription();
  if (!subscription) return "disabled";
  await register(subscription);
  return "enabled";
}
