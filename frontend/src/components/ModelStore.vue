<template>
  <section class="workspace-panel">
    <div class="workspace-panel__header">
      <div>
        <p>模型商店</p>
        <h1>模型资产与 AppKey</h1>
      </div>
      <el-button type="primary" round>申请模型</el-button>
    </div>

    <div class="asset-grid asset-grid--half">
      <article v-for="model in portal.models" :key="model.id" class="asset-card model-card">
        <div class="model-card__topline">
          <h3>{{ model.name }}</h3>
          <el-tag type="info">可接入</el-tag>
        </div>
        <p>{{ model.description }}</p>
        <div class="model-card__models">
          <span v-for="item in model.supportedModels" :key="item">{{ item }}</span>
        </div>
        <div class="app-key">
          <code>{{ model.appKey }}</code>
          <el-button size="small" type="primary" plain @click="copyAppKey(model.appKey)">复制</el-button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { ElMessage } from 'element-plus';

import { usePortalStore } from '@/stores/portal';

const portal = usePortalStore();

const copyAppKey = async (appKey) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(appKey);
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = appKey;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }

  ElMessage.success('AppKey 已复制');
};
</script>
