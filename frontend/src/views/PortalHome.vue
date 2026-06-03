<template>
  <el-container class="portal-shell">
    <el-header class="portal-header">
      <div class="portal-brand">
        <span class="portal-brand__mark">N</span>
        <div>
          <strong>Nexus Portal</strong>
          <small>AI capability marketplace for every team</small>
        </div>
      </div>

      <div class="portal-user">
        <span class="portal-user__avatar">{{ displayUser.avatar }}</span>
        <div>
          <strong>{{ displayUser.name }}</strong>
          <small>{{ displayUser.role }}</small>
        </div>
      </div>
    </el-header>

    <el-container class="portal-body">
      <el-aside width="248px" class="portal-sidebar">
        <el-menu :default-active="portal.activeSection" class="portal-menu" @select="portal.setActiveSection">
          <el-menu-item v-for="item in portal.navigationItems" :key="item.key" :index="item.key">
            <span class="portal-menu__badge">{{ item.badge }}</span>
            <span>{{ item.title }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-main class="portal-main">
        <section v-if="portal.activeSection === 'skillhub'" class="workspace-panel">
          <div class="workspace-panel__header">
            <div>
              <p>Skill Hub</p>
              <h1>可复用技能资产</h1>
            </div>
            <el-button type="primary" round @click="openCreateSkillDialog">发布技能</el-button>
          </div>

          <div class="category-tabs">
            <button
              v-for="category in portal.skillCategories"
              :key="category.key"
              :class="['category-tab', { 'is-active': portal.activeSkillCategory === category.key }]"
              type="button"
              @click="portal.setActiveSkillCategory(category.key)"
            >
              {{ category.label }}
            </button>
          </div>

          <div class="asset-grid asset-grid--quarter">
            <article v-for="skill in portal.filteredSkills" :key="skill.id" class="asset-card skill-card">
              <h3>{{ skill.name }}</h3>
              <p>{{ skill.description }}</p>
              <el-button type="primary" plain round>下载</el-button>
            </article>
          </div>
        </section>

        <section v-else-if="portal.activeSection === 'ai-tools'" class="workspace-panel">
          <div class="workspace-panel__header">
            <div>
              <p>AI工具</p>
              <h1>智能应用工作台</h1>
            </div>
            <el-button type="primary" round>创建工具</el-button>
          </div>

          <div class="category-tabs">
            <button
              v-for="category in portal.toolCategories"
              :key="category.key"
              :class="['category-tab', { 'is-active': portal.activeToolCategory === category.key }]"
              type="button"
              @click="portal.setActiveToolCategory(category.key)"
            >
              {{ category.label }}
            </button>
          </div>

          <div class="asset-grid asset-grid--quarter">
            <article v-for="tool in portal.filteredTools" :key="tool.id" class="asset-card tool-card">
              <span class="tool-card__logo">{{ tool.logo }}</span>
              <h3>{{ tool.name }}</h3>
              <p>{{ tool.description }}</p>
              <el-button type="success" plain round>使用</el-button>
            </article>
          </div>
        </section>

        <section v-else class="workspace-panel">
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
      </el-main>
    </el-container>

    <el-dialog v-model="createSkillVisible" title="创建技能" width="560px" align-center @closed="resetCreateSkillForm">
      <el-form class="create-skill-form" label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model.trim="createSkillForm.title" placeholder="输入技能标题" />
        </el-form-item>
        <el-form-item label="技能名称" required>
          <el-input v-model.trim="createSkillForm.name" placeholder="skill的真实名称，如pptx-craft" />
        </el-form-item>
        <el-form-item label="描述" required>
          <el-input
            v-model.trim="createSkillForm.description"
            placeholder="输入技能描述"
            :rows="4"
            type="textarea"
          />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="createSkillForm.type" placeholder="选择技能分类">
            <el-option v-for="category in skillPublishCategories" :key="category" :label="category" :value="category" />
          </el-select>
        </el-form-item>
        <el-form-item label="技能包上传" required>
          <input ref="packageInputRef" class="package-input" type="file" accept=".rar,.zip" @change="handlePackageChange" />
          <div class="package-upload">
            <el-button
              :loading="uploadingPackage"
              :disabled="Boolean(deletingPackageId)"
              type="primary"
              plain
              @click="selectPackageFile"
            >
              {{ hasUploadedPackage ? '继续上传 .rar / .zip 技能包' : '选择 .rar / .zip 技能包' }}
            </el-button>
            <div v-if="hasUploadedPackage" class="package-list">
              <div v-for="file in createSkillForm.files" :key="file.id" class="package-list__item">
                <span class="package-list__name" :title="file.originalName">{{ file.originalName }}</span>
                <el-button
                  :loading="deletingPackageId === file.id"
                  :disabled="uploadingPackage || Boolean(deletingPackageId)"
                  type="danger"
                  link
                  @click="deletePackageFile(file)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="createSkillVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!canPublishSkill" :loading="publishingSkill" @click="publishSkill">
          确认发布
        </el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';

import { CREATESKILL, FILE_DELETE, FILE_UPLOAD } from '@/request/constant';
import { del, post, upload } from '@/request/webservice';
import { useUserStore } from '@/store';
import { usePortalStore } from '@/stores/portal';

const portal = usePortalStore();
const userStore = useUserStore();

const displayUser = computed(() => ({
  avatar: userStore.avatar || portal.user.avatar,
  name: userStore.name || portal.user.name,
  role: userStore.role || portal.user.role
}));

const skillPublishCategories = ['通用与办公', '邮件与沟通', '会议与日程', '搜索与信息查询', '数据分析', '其他'];
const initialCreateSkillForm = () => ({
  title: '',
  name: '',
  description: '',
  type: '',
  files: []
});

const createSkillVisible = ref(false);
const packageInputRef = ref(null);
const uploadingPackage = ref(false);
const deletingPackageId = ref('');
const publishingSkill = ref(false);
const createSkillForm = reactive(initialCreateSkillForm());

const hasUploadedPackage = computed(() => createSkillForm.files.length > 0);
const canPublishSkill = computed(() => {
  return Boolean(
    createSkillForm.title
      && createSkillForm.name
      && createSkillForm.description
      && createSkillForm.type
      && hasUploadedPackage.value
      && !uploadingPackage.value
      && !deletingPackageId.value
      && !publishingSkill.value
  );
});

const resetCreateSkillForm = () => {
  Object.assign(createSkillForm, initialCreateSkillForm());
  if (packageInputRef.value) {
    packageInputRef.value.value = '';
  }
};

const openCreateSkillDialog = () => {
  createSkillVisible.value = true;
};

const selectPackageFile = () => {
  if (uploadingPackage.value || deletingPackageId.value) {
    return;
  }

  packageInputRef.value?.click();
};

const handlePackageChange = (event) => {
  const [file] = event.target.files;
  event.target.value = '';

  if (!file) {
    return;
  }

  if (!/\.(rar|zip)$/i.test(file.name)) {
    ElMessage.error('技能包只支持 .rar 或 .zip 压缩包');
    return;
  }

  uploadingPackage.value = true;
  upload(FILE_UPLOAD, file, {}, (data, error) => {
    uploadingPackage.value = false;

    if (error) {
      ElMessage.error('技能包上传失败');
      return;
    }

    const uploadedFile = {
      id: data?.id || data?.fileId || '',
      originalName: data?.originalName || data?.fileName || data?.name || file.name
    };

    if (!uploadedFile.id) {
      ElMessage.error('技能包上传结果缺少文件 ID');
      return;
    }

    createSkillForm.files.push(uploadedFile);
    ElMessage.success('技能包上传成功');
  });
};

const deletePackageFile = (file) => {
  deletingPackageId.value = file.id;
  del(
    FILE_DELETE,
    {
      fileName: file.originalName,
      fileId: file.id
    },
    (_, error) => {
      deletingPackageId.value = '';

      if (error) {
        ElMessage.error('技能包删除失败');
        return;
      }

      createSkillForm.files = createSkillForm.files.filter((item) => item.id !== file.id);
      ElMessage.success('技能包已删除');
    }
  );
};

const publishSkill = () => {
  if (!canPublishSkill.value) {
    return;
  }

  const { title, name, description, type, files } = createSkillForm;

  publishingSkill.value = true;
  post(CREATESKILL, { title, name, description, type, files }, (_, error) => {
    publishingSkill.value = false;

    if (error) {
      ElMessage.error('技能发布失败');
      return;
    }

    ElMessage.success('技能发布成功');
    createSkillVisible.value = false;
  });
};

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
