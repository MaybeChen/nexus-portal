<template>
  <main class="html2pptx-page">
    <section class="html2pptx-hero">
      <div>
        <p class="html2pptx-eyebrow">HTML2PPTX</p>
        <h1>本地 HTML 转 PowerPoint</h1>
        <p class="html2pptx-subtitle">
          选择多个 HTML 文件，或选择包含 HTML、CSS、图片、字体等资源的目录。工具会在浏览器本地预览并导出 PPTX。
        </p>
      </div>
      <el-tag type="success" size="large">本地处理</el-tag>
    </section>

    <section class="html2pptx-workbench">
      <aside class="html2pptx-sidebar">
        <div class="html2pptx-upload-card">
          <el-button type="primary" size="large" @click="pickHtmlFiles">选择 HTML 文件</el-button>
          <el-button size="large" @click="pickDirectory">选择目录</el-button>
          <input ref="fileInputRef" class="html2pptx-hidden-input" type="file" multiple accept=".html,.htm,text/html" @change="handleFilesSelected" />
          <input ref="directoryInputRef" class="html2pptx-hidden-input" type="file" multiple webkitdirectory @change="handleFilesSelected" />
          <p>目录模式可自动关联相对路径资源；多个独立 HTML 文件适合无外部资源或资源已内联的页面。</p>
        </div>

        <el-alert v-if="workspaceError" :title="workspaceError" type="error" show-icon :closable="false" />

        <div class="html2pptx-file-panel">
          <div class="html2pptx-panel-title">
            <strong>HTML 文件</strong>
            <span>{{ htmlFiles.length }}</span>
          </div>
          <el-empty v-if="!htmlFiles.length" description="还没有选择文件" :image-size="80" />
          <button
            v-for="(item, index) in htmlFiles"
            v-else
            :key="item.path"
            class="html2pptx-file-item"
            :class="{ 'is-active': index === activeIndex }"
            type="button"
            @click="setActiveIndex(index)"
          >
            <span>{{ item.name }}</span>
            <small>{{ item.path }}</small>
          </button>
        </div>
      </aside>

      <section class="html2pptx-preview-panel">
        <header class="html2pptx-toolbar">
          <div>
            <strong>{{ activeItem?.name || '预览' }}</strong>
            <small v-if="activeItem">{{ activeItem.path }}</small>
          </div>
          <div class="html2pptx-actions">
            <el-button :disabled="!activeItem || exporting" @click="diagnoseFonts">字体诊断</el-button>
            <el-button :disabled="!activeItem || exporting" @click="exportCurrent">导出当前 HTML</el-button>
            <el-button type="primary" :disabled="!htmlFiles.length || exporting" :loading="exporting" @click="exportAll">导出全部 HTML</el-button>
          </div>
        </header>

        <el-alert
          v-if="statusText"
          class="html2pptx-status"
          :title="statusText"
          :type="statusType"
          show-icon
          :closable="statusType !== 'error'"
          @close="statusText = ''"
        />

        <el-alert
          v-for="warning in previewWarnings"
          :key="warning"
          class="html2pptx-status"
          :title="warning"
          type="warning"
          show-icon
          :closable="false"
        />

        <div v-if="fontDiagnostics.length" class="html2pptx-diagnostics">
          <strong>中文字体诊断</strong>
          <ul>
            <li v-for="item in fontDiagnostics" :key="`${item.text}-${item.fontFamily}`">
              <span>{{ item.text }}</span>
              <small>{{ item.fontFamily }}</small>
            </li>
          </ul>
        </div>

        <div class="html2pptx-frame-wrap">
          <iframe
            v-if="previewHtml"
            ref="previewFrameRef"
            title="HTML2PPTX preview"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            :srcdoc="previewHtml"
          />
          <el-empty v-else description="选择 HTML 文件后在这里预览" />
        </div>
      </section>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { exportItemsToPptx } from './exporter';
import { buildWorkspace, readHtmlDocument, revokeWorkspaceUrls } from './fileWorkspace';

const fileInputRef = ref();
const directoryInputRef = ref();
const previewFrameRef = ref();
const fontDiagnostics = ref([]);
const htmlFiles = ref([]);
const fileMap = ref(new Map());
const objectUrls = ref([]);
const activeIndex = ref(0);
const previewHtml = ref('');
const previewWarnings = ref([]);
const workspaceError = ref('');
const statusText = ref('');
const statusType = ref('info');
const exporting = ref(false);

const activeItem = computed(() => htmlFiles.value[activeIndex.value]);

function resetInput(input) {
  if (input) input.value = '';
}

function pickHtmlFiles() {
  resetInput(fileInputRef.value);
  fileInputRef.value?.click();
}

function pickDirectory() {
  resetInput(directoryInputRef.value);
  directoryInputRef.value?.click();
}

function clearWorkspaceUrls() {
  revokeWorkspaceUrls(objectUrls.value);
  objectUrls.value = [];
}

function handleFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  workspaceError.value = '';
  statusText.value = '';
  clearWorkspaceUrls();

  const workspace = buildWorkspace(files);
  htmlFiles.value = workspace.htmlFiles;
  fileMap.value = workspace.fileMap;
  objectUrls.value = workspace.objectUrls;
  activeIndex.value = 0;

  if (!workspace.htmlFiles.length) {
    workspaceError.value = '所选内容中没有发现 .html 或 .htm 文件';
  }
}

function setActiveIndex(index) {
  activeIndex.value = index;
}

async function refreshPreview() {
  previewHtml.value = '';
  previewWarnings.value = [];
  fontDiagnostics.value = [];
  if (!activeItem.value) return;

  try {
    const result = await readHtmlDocument(activeItem.value, fileMap.value);
    previewHtml.value = result.html;
    previewWarnings.value = result.warnings;
  } catch (error) {
    statusType.value = 'error';
    statusText.value = `读取预览失败：${error?.message || error}`;
  }
}

async function runExport(items, filename) {
  exporting.value = true;
  statusType.value = 'info';
  statusText.value = '正在加载转换引擎...';

  try {
    await exportItemsToPptx({
      items,
      fileMap: fileMap.value,
      filename,
      onProgress: ({ index, total, item }) => {
        statusText.value = `正在准备第 ${index + 1}/${total} 个 HTML：${item.name}`;
      }
    });
    statusType.value = 'success';
    statusText.value = `导出完成：${filename}`;
  } catch (error) {
    statusType.value = 'error';
    statusText.value = `导出失败：${error?.message || error}`;
  } finally {
    exporting.value = false;
  }
}

function diagnoseFonts() {
  const document = previewFrameRef.value?.contentDocument;
  if (!document) return;

  const diagnostics = Array.from(document.body?.querySelectorAll('*') || [])
    .map((element) => ({
      text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
      fontFamily: window.getComputedStyle(element).fontFamily
    }))
    .filter((item) => /[\u4e00-\u9fff]/.test(item.text))
    .slice(0, 12);

  fontDiagnostics.value = diagnostics;
  statusType.value = diagnostics.length ? 'success' : 'info';
  statusText.value = diagnostics.length ? `发现 ${diagnostics.length} 个中文文本节点，已显示字体回退结果` : '当前预览没有发现中文文本节点';
}

function exportCurrent() {
  if (!activeItem.value) return;
  runExport([activeItem.value], activeItem.value.name.replace(/\.html?$/i, '.pptx'));
}

function exportAll() {
  runExport(htmlFiles.value, 'all-html-files.pptx');
}

watch(activeItem, refreshPreview, { immediate: true });

onBeforeUnmount(() => {
  clearWorkspaceUrls();
});
</script>

<style scoped>
.html2pptx-page {
  min-height: 100vh;
  padding: 28px;
  color: #172033;
  background:
    radial-gradient(circle at 10% 10%, rgba(99, 91, 255, 0.2), transparent 28rem),
    linear-gradient(135deg, #f8fbff 0%, #eef2ff 100%);
}

.html2pptx-hero,
.html2pptx-workbench,
.html2pptx-upload-card,
.html2pptx-file-panel,
.html2pptx-preview-panel {
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
}

.html2pptx-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 22px;
  padding: 28px;
  border-radius: 28px;
}

.html2pptx-eyebrow {
  margin: 0 0 8px;
  color: #635bff;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.html2pptx-hero h1 {
  margin: 0;
  color: #0f172a;
  font-size: 34px;
}

.html2pptx-subtitle {
  max-width: 760px;
  margin: 12px 0 0;
  color: #64748b;
  line-height: 1.7;
}

.html2pptx-workbench {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 20px;
  min-height: calc(100vh - 190px);
  padding: 20px;
  border-radius: 28px;
}

.html2pptx-sidebar,
.html2pptx-preview-panel {
  min-width: 0;
}

.html2pptx-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.html2pptx-upload-card,
.html2pptx-file-panel,
.html2pptx-preview-panel {
  border-radius: 22px;
}

.html2pptx-upload-card {
  display: grid;
  gap: 12px;
  padding: 18px;
}

.html2pptx-upload-card p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.html2pptx-hidden-input {
  display: none;
}

.html2pptx-file-panel {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}

.html2pptx-panel-title,
.html2pptx-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.html2pptx-panel-title {
  margin-bottom: 12px;
}

.html2pptx-panel-title span {
  display: inline-grid;
  min-width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  background: #635bff;
}

.html2pptx-file-item {
  display: block;
  width: 100%;
  margin-bottom: 10px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  text-align: left;
  background: #fff;
  cursor: pointer;
}

.html2pptx-file-item.is-active {
  border-color: rgba(99, 91, 255, 0.6);
  background: rgba(99, 91, 255, 0.08);
}

.html2pptx-file-item span,
.html2pptx-file-item small,
.html2pptx-toolbar strong,
.html2pptx-toolbar small {
  display: block;
}

.html2pptx-file-item span {
  color: #0f172a;
  font-weight: 700;
}

.html2pptx-file-item small,
.html2pptx-toolbar small {
  margin-top: 4px;
  color: #64748b;
  word-break: break-all;
}

.html2pptx-preview-panel {
  display: flex;
  flex-direction: column;
  padding: 18px;
}

.html2pptx-toolbar {
  margin-bottom: 14px;
}

.html2pptx-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.html2pptx-status {
  margin-bottom: 12px;
}

.html2pptx-diagnostics {
  margin-bottom: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(99, 91, 255, 0.18);
  border-radius: 16px;
  background: rgba(99, 91, 255, 0.06);
}

.html2pptx-diagnostics ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.html2pptx-diagnostics li {
  min-width: 0;
}

.html2pptx-diagnostics span,
.html2pptx-diagnostics small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.html2pptx-diagnostics small {
  margin-top: 3px;
  color: #64748b;
}

.html2pptx-frame-wrap {
  display: grid;
  flex: 1;
  min-height: 620px;
  overflow: hidden;
  place-items: center;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  background: #f8fafc;
}

.html2pptx-frame-wrap iframe {
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}
</style>
