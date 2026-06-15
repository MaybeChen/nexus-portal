<template>
  <router-view />
</template>

<script setup>
import { onBeforeMount } from 'vue';

import { getUserInfo,getUserPermission } from '@/request/service';

onBeforeMount(async () => {
  await getUserInfo();
  getUserPermission();
});
</script>
