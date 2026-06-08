<template>
  <router-view />
</template>

<script setup>
import { onBeforeMount } from 'vue';

import { getUserInfo } from '@/request/service';

onBeforeMount(async () => {
  await getUserInfo();
});
</script>
