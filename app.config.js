// Extends app.json so OTA/EAS values can come from the environment instead of
// being edited in code. `eas update:configure` (or a CI secret) can set these:
//   EXPO_UPDATES_URL   -> overrides updates.url (Expo's update server)
//   EAS_PROJECT_ID     -> extra.eas.projectId, needed by `eas update`
// Locally nothing changes: app.json stays the source of truth.
const appJson = require('./app.json');

module.exports = () => {
  const base = appJson.expo;
  const updatesUrl = process.env.EXPO_UPDATES_URL;
  const projectId = process.env.EAS_PROJECT_ID;

  return {
    ...base,
    updates: {
      ...(base.updates || {}),
      ...(updatesUrl ? { url: updatesUrl } : {})
    },
    extra: {
      ...(base.extra || {}),
      ...(projectId ? { eas: { ...(base.extra && base.extra.eas), projectId } } : {})
    }
  };
};
