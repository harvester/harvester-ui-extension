// Mirrors Resource class methods from @shell/plugins/dashboard-store/resource-class.js
// useRouter()/useRoute() from vue-router don't work in extension mode,
// so we use the same global access pattern the shell uses internally.

export function currentRouter() {
  return window.$globalApp.$router;
}

export function currentRoute() {
  return window.$globalApp.$route;
}
