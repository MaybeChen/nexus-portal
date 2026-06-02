<template>
  <article class="section-card">
    <div class="section-card__header">
      <div class="section-card__icon" :style="{ background: section.color }">
        <span>{{ section.badge }}</span>
      </div>
      <div>
        <p>{{ section.subtitle }}</p>
        <h3>{{ section.title }}</h3>
      </div>
    </div>
    <p class="section-card__description">{{ section.description }}</p>
    <div class="section-card__metrics">
      <div v-for="metric in section.metrics" :key="metric.label">
        <strong>{{ metric.value }}</strong>
        <span>{{ metric.label }}</span>
      </div>
    </div>
  </article>
</template>

<script setup>
defineProps({
  section: {
    type: Object,
    required: true
  }
});
</script>
