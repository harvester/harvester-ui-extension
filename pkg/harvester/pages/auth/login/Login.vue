<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import { useI18n } from '@shell/composables/useI18n';
import { USERNAME } from '@shell/config/cookies';
import { LOGGED_OUT, TIMED_OUT, _FLAGGED } from '@shell/config/query-params';
import { getVendor } from '@shell/config/private-label';
import BrandImage from '@shell/components/BrandImage';
import AsyncButton from '@shell/components/AsyncButton';
import TabTitle from '@shell/components/TabTitle.vue';
import Password from '@shell/components/form/Password';
import { LabeledInput } from '@components/Form/LabeledInput';
import { Checkbox } from '@components/Form/Checkbox';
import { Banner } from '@components/Banner';
import { harvesterLocalLogin, LOGIN_ERRORS } from '../../../utils/auth';

const store = useStore();
const route = useRoute();
const { t } = useI18n(store);

const username = ref('');
const password = ref('');
const remember = ref(false);
const err = ref(null);
const timedOut = ref(route.query[TIMED_OUT] === _FLAGGED);
const loggedOut = ref(route.query[LOGGED_OUT] === _FLAGGED);

const usernameInput = ref(null);

const vendor = computed(() => getVendor() || t('harvester.productLabel'));

const logo = computed(() => store.getters['isSingleProduct']?.logo || require('@shell/assets/images/providers/harvester.svg'));

const errorMessage = computed(() => {
  switch (err.value) {
  case null:
  case '':
    return '';
  case LOGIN_ERRORS.CLIENT_UNAUTHORIZED:
    return t('login.clientError');
  case LOGIN_ERRORS.CLIENT:
  case LOGIN_ERRORS.SERVER:
    return t('login.error');
  default:
    return t('login.specificError', { msg: err.value });
  }
});

const loginMessages = computed(() => {
  const out = [];

  if (errorMessage.value) {
    out.push({ message: errorMessage.value, variant: 'error' });
  } else if (timedOut.value) {
    out.push({ message: t('login.loginAgain'), variant: 'info' });
  } else if (loggedOut.value) {
    out.push({ message: t('login.loggedOut'), variant: 'success' });
  }

  return out;
});

function rememberUsername() {
  if (remember.value) {
    store.commit('cookies/set', {
      key:     USERNAME,
      value:   username.value,
      options: {
        encode: (x) => x, maxAge: 86400 * 365, path: '/', sameSite: true, secure: true
      },
    });
  } else {
    store.commit('cookies/remove', { key: USERNAME });
  }
}

async function login(buttonCb) {
  try {
    await harvesterLocalLogin(store, { username: username.value.trim(), password: password.value });
  } catch (e) {
    err.value = typeof e === 'string' ? e : e?.message || LOGIN_ERRORS.SERVER;
    timedOut.value = false;
    loggedOut.value = false;
    buttonCb(false);

    return;
  }

  rememberUsername();
  buttonCb(true);

  // Go to the dashboard root (`/dashboard/` on a cluster, `/` in dev) with a full page load,
  // so the app boots again with the new session. Its index page then picks the destination.
  window.location.href = process.env.routerBase || '/';
}

onMounted(async() => {
  const saved = store.getters['cookies/get']({ key: USERNAME, options: { parseJSON: false } });

  username.value = saved || '';
  remember.value = !!saved;

  await nextTick();
  usernameInput.value?.focus();
});
</script>

<template>
  <div class="main-layout login">
    <TabTitle
      :show-child="false"
      :breadcrumb="false"
    >
      {{ `${ vendor } - ${ t('login.login') }` }}
    </TabTitle>
    <div class="row gutless">
      <div class="col span-6 p-20 login-panel">
        <img
          class="login-logo"
          :src="logo"
          :alt="t('login.logoAlt', { vendor })"
        >
        <h1 class="text-center login-welcome">
          {{ t('login.welcome', { vendor }) }}
        </h1>
        <div
          class="login-messages"
          data-testid="login__messages"
          :class="{ 'login-messages--hasContent': loginMessages.length }"
        >
          <Banner
            v-for="message in loginMessages"
            :key="message.variant"
            :label="message.message"
            :color="message.variant"
            :role="message.variant === 'error' ? 'alert' : 'status'"
          />
        </div>
        <form
          class="login-column"
          :class="{ 'mt-30': !loginMessages.length }"
          @submit.prevent
        >
          <div class="mb-20">
            <LabeledInput
              ref="usernameInput"
              v-model:value="username"
              data-testid="local-login-username"
              :label="t('login.username')"
              autocomplete="username"
            />
          </div>
          <Password
            v-model:value="password"
            data-testid="local-login-password"
            :label="t('login.password')"
            autocomplete="current-password"
          />
          <div class="mt-20 text-center">
            <AsyncButton
              id="submit"
              class="login-column__submit"
              data-testid="login-submit"
              type="submit"
              :action-label="t('login.login')"
              :waiting-label="t('login.loggingIn')"
              :success-label="t('login.loggedIn')"
              :error-label="t('asyncButton.default.error')"
              @click="login"
            />
            <div class="mt-20">
              <Checkbox
                v-model:value="remember"
                data-testid="login-remember"
                :label="t('login.remember.label')"
              />
            </div>
          </div>
        </form>
      </div>
      <BrandImage
        class="col span-6 landscape"
        data-testid="login-landscape__img"
        file-name="login-landscape.svg"
        alt=""
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login {
  --login-column-width: 362px;

  overflow: hidden;

  .row {
    align-items: center;
  }

  .landscape {
    height: 100vh;
    margin: 0;
    object-fit: cover;
  }

  .login-welcome {
    margin: 0;
  }

  .login-logo {
    align-self: center;
    max-width: 260px;
    max-height: 60px;
    margin-bottom: 20px;
  }

  .login-messages {
    width: var(--login-column-width);
    max-width: 100%;
    align-self: center;
    display: flex;
    justify-content: center;
    align-items: center;

    &--hasContent {
      min-height: 70px;
    }

    .banner {
      width: 100%;
      margin: 5px 0;
    }
  }

  .login-column {
    width: var(--login-column-width);
    max-width: 100%;
    align-self: center;
  }

  .login-column__submit {
    width: 100%;
    justify-content: center;
  }
}

.gutless {
  height: 100vh;

  & > .span-6 {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    height: 100%;
    place-content: center;
    justify-content: safe center;
  }
}

.login-panel {
  padding-bottom: 60px;
}
</style>
