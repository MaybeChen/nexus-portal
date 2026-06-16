<template>
  <main class="html2pptx-page">
    <div class="html2pptx-shell">
      <header class="html2pptx-topbar">
        <div class="html2pptx-brand">
          <span class="html2pptx-logo">◇</span>
          <span>HTML 转 PowerPoint</span>
        </div>
      </header>

      <section class="html2pptx-hero">
        <div class="html2pptx-hero-copy">
          <h1>本地 <span>HTML</span> 转 <span>PowerPoint</span></h1>
          <p class="html2pptx-subtitle">
            选择单个HTML 文件，或选择完整目录，工具会在浏览器本地完成预览并导出 PPTX。
          </p>
        </div>
        <div class="html2pptx-hero-art" aria-hidden="true">
          <span class="html2pptx-orbit html2pptx-orbit-one"></span>
          <span class="html2pptx-orbit html2pptx-orbit-two"></span>
          <span class="html2pptx-doc-card"></span>
          <span class="html2pptx-ppt-card">P</span>
          <span class="html2pptx-cube"></span>
          <span class="html2pptx-dot"></span>
        </div>
      </section>

      <section class="html2pptx-workbench">
        <aside class="html2pptx-sidebar">
          <div class="html2pptx-upload-card">
            <el-button class="html2pptx-main-button" type="primary" size="large" @click="pickHtmlFiles">▣ 选择 HTML 文件</el-button>
            <el-button class="html2pptx-directory-button" size="large" @click="pickDirectory">选择目录</el-button>
            <input ref="fileInputRef" class="html2pptx-hidden-input" type="file" multiple accept=".html,.htm,text/html" @change="handleFilesSelected" />
            <input ref="directoryInputRef" class="html2pptx-hidden-input" type="file" multiple webkitdirectory @change="handleFilesSelected" />
            <p>目录或文件会在本地浏览器中处理，多个独立 HTML 文件请放在同目录或使用内联资源。</p>
          </div>

          <el-alert v-if="workspaceError" :title="workspaceError" type="error" show-icon :closable="false" />

          <div class="html2pptx-file-panel">
            <div class="html2pptx-panel-title">
              <strong>HTML 文件</strong>
              <span>{{ htmlFiles.length }}</span>
            </div>
            <div class="html2pptx-file-list">
              <el-empty v-if="!htmlFiles.length" description="还没有选择文件" :image-size="92" />
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
            <div class="html2pptx-security-note">
              <span>♧</span>
              <p>所有转换均在本地完成，文件不会上传到任何服务器。</p>
            </div>
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
              @load="handlePreviewLoaded"
            />
            <el-empty v-else description="选择 HTML 文件后在此预览效果" :image-size="128" />
          </div>
        </section>
      </section>

      <footer class="html2pptx-footer">© 2024 HTML 转 PowerPoint · 完全在本地运行</footer>
    </div>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { exportItemsToPptx, waitForDocumentFonts } from './exporter';
import { buildWorkspace, readHtmlDocument, revokeWorkspaceUrls } from './fileWorkspace';

const fileInputRef = ref();
const directoryInputRef = ref();
const previewFrameRef = ref();
const fontDiagnostics = ref([]);
const htmlFiles = ref([]);
const fileMap = ref(new Map());
const objectUrls = ref([]);
const previewObjectUrls = ref([]);
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

function clearPreviewUrls() {
  revokeWorkspaceUrls(previewObjectUrls.value);
  previewObjectUrls.value = [];
}

function clearWorkspaceUrls() {
  clearPreviewUrls();
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
  clearPreviewUrls();
  previewHtml.value = '';
  previewWarnings.value = [];
  fontDiagnostics.value = [];
  if (!activeItem.value) return;

  try {
    const result = await readHtmlDocument(activeItem.value, fileMap.value);
    previewHtml.value = result.html;
    previewWarnings.value = result.warnings;
    previewObjectUrls.value = result.objectUrls || [];
  } catch (error) {
    statusType.value = 'error';
    statusText.value = `读取预览失败：${error?.message || error}`;
  }
}

async function handlePreviewLoaded() {
  const iframe = previewFrameRef.value;
  const document = iframe?.contentDocument;
  if (!document) return;

  await waitForDocumentFonts(document);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  // Force a style/layout read after the web fonts become available so
  // pseudo-element icon glyphs are repainted in the preview iframe.
  document.documentElement.getBoundingClientRect();
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
  padding: 26px 32px 76px;
  color: #111827;
  background:
    radial-gradient(circle at 83% 13%, rgba(99, 102, 241, 0.14), transparent 28rem),
    radial-gradient(circle at 8% 8%, rgba(59, 130, 246, 0.1), transparent 20rem),
    linear-gradient(180deg, #f4f7ff 0%, #eef3fb 100%);
}

.html2pptx-shell {
  width: 80%;
  margin: 0 auto;
}

.html2pptx-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.html2pptx-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #111827;
  font-size: 18px;
  font-weight: 800;
}

.html2pptx-logo {
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 10px;
  color: #fff;
  background: linear-gradient(135deg, #2f80ed, #5147ff);
  box-shadow: 0 10px 22px rgba(47, 128, 237, 0.28);
}


.html2pptx-hero,
.html2pptx-upload-card,
.html2pptx-file-panel,
.html2pptx-preview-panel {
  border: 1px solid rgba(226, 232, 240, 0.86);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.045);
}

.html2pptx-hero {
  position: relative;
  display: flex;
  min-height: 178px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  overflow: hidden;
  padding: 34px 44px;
  border-radius: 12px;
}

.html2pptx-hero::after {
  position: absolute;
  inset: 0 0 0 auto;
  width: 48%;
  content: '';
  background: linear-gradient(90deg, transparent, rgba(219, 228, 255, 0.65));
  pointer-events: none;
}

.html2pptx-hero-copy {
  position: relative;
  z-index: 1;
  max-width: 760px;
}

.html2pptx-hero h1 {
  margin: 0;
  color: #071224;
  font-size: clamp(32px, 3.1vw, 46px);
  font-weight: 900;
  letter-spacing: -0.04em;
}

.html2pptx-hero h1 span {
  color: #2563eb;
}

.html2pptx-subtitle {
  max-width: none;
  margin: 18px 0 0;
  white-space: nowrap;
  color: #64748b;
  font-size: 15px;
  line-height: 1.75;
}

.html2pptx-hero-art {
  position: relative;
  z-index: 1;
  width: 340px;
  height: 150px;
  flex: 0 0 340px;
}

.html2pptx-ppt-card {
  position: absolute;
  right: 88px;
  top: 24px;
  display: grid;
  width: 76px;
  height: 86px;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  font-size: 44px;
  font-weight: 800;
  background: linear-gradient(145deg, #5d67ff, #3b49df);
  box-shadow: 0 20px 38px rgba(59, 73, 223, 0.25);
}

.html2pptx-doc-card {
  position: absolute;
  left: 76px;
  top: 28px;
  width: 84px;
  height: 72px;
  transform: rotate(-13deg);
  border-radius: 6px;
  background:
    linear-gradient(90deg, rgba(37, 99, 235, 0.28) 0 12px, transparent 12px),
    repeating-linear-gradient(180deg, rgba(99, 102, 241, 0.16) 0 8px, transparent 8px 17px),
    rgba(255, 255, 255, 0.72);
  box-shadow: 0 16px 30px rgba(99, 102, 241, 0.16);
}

.html2pptx-orbit {
  position: absolute;
  right: 44px;
  bottom: 14px;
  border: 10px solid rgba(99, 102, 241, 0.18);
  border-radius: 50%;
  transform: rotate(-9deg);
}

.html2pptx-orbit-one {
  width: 190px;
  height: 54px;
}

.html2pptx-orbit-two {
  right: 74px;
  bottom: 30px;
  width: 116px;
  height: 90px;
  border-width: 8px;
  opacity: 0.45;
}

.html2pptx-cube,
.html2pptx-dot {
  position: absolute;
  border-radius: 8px;
  background: linear-gradient(135deg, #dce6ff, #8b9cff);
}

.html2pptx-cube {
  left: 8px;
  top: 70px;
  width: 26px;
  height: 26px;
}

.html2pptx-dot {
  right: 2px;
  top: 40px;
  width: 18px;
  height: 18px;
  border: 8px solid rgba(79, 70, 229, 0.2);
  background: #fff;
}

.html2pptx-workbench {
  display: grid;
  grid-template-columns: 314px minmax(0, 1fr);
  gap: 18px;
  min-height: calc(100vh - 298px);
}

.html2pptx-sidebar,
.html2pptx-preview-panel {
  min-width: 0;
}

.html2pptx-sidebar {
  display: flex;
  max-height: calc(100vh - 326px);
  min-height: 0;
  flex-direction: column;
  gap: 18px;
}

.html2pptx-upload-card,
.html2pptx-file-panel,
.html2pptx-preview-panel {
  border-radius: 12px;
}

.html2pptx-upload-card {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.html2pptx-main-button {
  width: 100%;
  height: 42px;
  border: 0;
  border-radius: 5px;
  font-weight: 700;
  background: linear-gradient(90deg, #0f66ff, #2f7df4);
}

.html2pptx-directory-button {
  width: 100%;
  height: 38px;
  margin-left: 0 !important;
  border: 0;
  color: #6b7280;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.html2pptx-upload-card p {
  margin: 2px 0 0;
  color: #7b8797;
  font-size: 13px;
  line-height: 1.65;
}

.html2pptx-hidden-input {
  display: none;
}

.html2pptx-file-panel {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
}

.html2pptx-panel-title,
.html2pptx-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.html2pptx-panel-title {
  margin-bottom: 18px;
}

.html2pptx-file-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.html2pptx-panel-title strong,
.html2pptx-toolbar strong {
  color: #111827;
  font-size: 18px;
}

.html2pptx-panel-title span {
  display: inline-grid;
  min-width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 999px;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  background: linear-gradient(135deg, #6c63ff, #4f46e5);
}

.html2pptx-file-item {
  display: block;
  width: 100%;
  margin-bottom: 10px;
  padding: 12px;
  border: 1px solid rgba(203, 213, 225, 0.75);
  border-radius: 10px;
  text-align: left;
  background: #fff;
  cursor: pointer;
}

.html2pptx-file-item.is-active {
  border-color: rgba(37, 99, 235, 0.5);
  background: #eff6ff;
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

.html2pptx-security-note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  flex: 0 0 auto;
  margin-top: 18px;
  padding-top: 22px;
  border-top: 1px solid #e5e7eb;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}

.html2pptx-security-note span {
  color: #22c55e;
  font-size: 18px;
}

.html2pptx-security-note p {
  margin: 0;
}

.html2pptx-preview-panel {
  display: flex;
  flex-direction: column;
  padding: 26px 22px 20px;
}

.html2pptx-toolbar {
  margin-bottom: 18px;
}

.html2pptx-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.html2pptx-actions :deep(.el-button) {
  min-width: 112px;
  border-radius: 5px;
}

.html2pptx-status {
  margin-bottom: 12px;
}

.html2pptx-diagnostics {
  margin-bottom: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(99, 91, 255, 0.18);
  border-radius: 12px;
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
  min-height: 650px;
  overflow: hidden;
  place-items: center;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(248, 250, 252, 0.72)),
    #f8fafc;
}

.html2pptx-frame-wrap iframe {
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

.html2pptx-footer {
  padding: 28px 0 0;
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
}

@media (max-width: 1100px) {
  .html2pptx-workbench {
    grid-template-columns: 1fr;
  }

  .html2pptx-hero-art {
    display: none;
  }
}

@media (max-width: 720px) {
  .html2pptx-page {
    padding: 18px 18px 56px;
  }

  .html2pptx-shell {
    width: 100%;
  }

  .html2pptx-subtitle {
    white-space: normal;
  }

  .html2pptx-hero {
    padding: 26px;
  }

  .html2pptx-toolbar,
  .html2pptx-topbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
