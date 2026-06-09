<template>
  <section class="workspace-panel">
    <div class="workspace-panel__header">
      <div>
        <p>Skill Hub</p>
      </div>
      <el-button class="primary-action" type="primary" round @click="openCreateSkillDialog">＋ 发布技能</el-button>
    </div>

    <div v-loading="loadingSkills" class="asset-grid asset-grid--quarter">
      <article v-for="skill in skills" :key="skill.id || skill.name" class="asset-card skill-card">
        <el-tag class="skill-card__type" type="primary" effect="light">{{ skill.type || '未分类' }}</el-tag>
        <div class="skill-card__content">
          <h3>{{ skill.title || skill.name }}</h3>
          <span v-if="skill.title && skill.name && skill.title !== skill.name" class="skill-card__name">{{ skill.name }}</span>
          <p>{{ skill.description }}</p>
        </div>
        <div class="skill-card__footer">
          <div class="skill-card__meta">
            <span class="skill-card__usage">
              <img class="skill-card__usage-icon" :src="skillUsageHotIcon" alt="" aria-hidden="true" />
              {{ formatUsageCount(getSkillUsageCount(skill)) }} 次使用
            </span>
            <span v-if="getSkillAuthorText(skill)" class="skill-card__author" :title="getSkillAuthorText(skill)">
              · {{ getSkillAuthorText(skill) }}
            </span>
          </div>
          <div class="skill-card__actions">
            <el-button class="skill-card__download" aria-label="下载" @click="openDownloadDialog(skill)">
              <img class="skill-card__download-icon skill-card__download-icon--normal" :src="downloadNormalIcon" alt="" aria-hidden="true" />
              <img class="skill-card__download-icon skill-card__download-icon--high" :src="downloadHighIcon" alt="" aria-hidden="true" />
            </el-button>
            <el-dropdown v-if="canManageSkill(skill)" trigger="click" placement="bottom-end">
              <el-button class="skill-card__more" aria-label="更多操作">
                <img class="skill-card__more-icon" :src="moreIcon" alt="" aria-hidden="true" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openUpdateSkillDialog(skill)">
                    <el-icon><RefreshRight /></el-icon>
                    <span>更新</span>
                  </el-dropdown-item>
                  <el-dropdown-item
                    :disabled="Boolean(deletingSkillId)"
                    @click="handleDeleteSkill(skill)"
                  >
                    <el-icon><Delete /></el-icon>
                    <span>{{ deletingSkillId === getSkillId(skill) ? '删除中' : '删除' }}</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </article>
    </div>

    <el-empty v-if="!loadingSkills && skills.length === 0" description="暂无技能资产" />

    <el-dialog v-model="downloadVisible" :title="`${activeSkill?.title || activeSkill?.name || '技能'} 文件列表`" width="520px" append-to-body align-center>
      <div v-if="downloadFiles.length" class="download-file-list">
        <div
          v-for="file in downloadFiles"
          :key="file.id || file.originalName"
          :class="['download-file-list__item', { 'is-disabled': downloadingFileId === file.id }]"
          role="button"
          tabindex="0"
          @click="downloadFile(file)"
          @keydown.enter="downloadFile(file)"
        >
          <span>{{ file.originalName || file.name }}</span>
          <el-button :loading="downloadingFileId === file.id" type="primary" link>下载</el-button>
        </div>
      </div>
      <el-empty v-else description="该技能暂无可下载文件" />
    </el-dialog>

    <el-dialog v-model="createSkillVisible" :title="skillDialogTitle" width="560px" append-to-body align-center @closed="resetCreateSkillForm">
      <el-form class="create-skill-form" label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model.trim="createSkillForm.title" placeholder="输入技能标题" />
        </el-form-item>
        <el-form-item label="技能名称" required>
          <el-input v-model.trim="createSkillForm.name" placeholder="skill的真实名称，如pptx-craft" />
        </el-form-item>
        <el-form-item label="描述" required>
          <el-input v-model.trim="createSkillForm.description" placeholder="输入技能描述" :rows="4" type="textarea" />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="createSkillForm.type" placeholder="选择技能分类">
            <el-option v-for="category in skillPublishCategories" :key="category" :label="category" :value="category" />
          </el-select>
        </el-form-item>
        <el-form-item label="技能包上传" required>
          <input ref="packageInputRef" class="package-input" type="file" @change="handlePackageChange" />
          <div class="package-upload">
            <el-button
              :loading="uploadingPackage"
              :disabled="Boolean(deletingPackageId)"
              type="primary"
              plain
              @click="selectPackageFile"
            >
              {{ hasUploadedPackage ? '继续上传技能包' : '选择技能包' }}
            </el-button>
            <div v-if="hasUploadedPackage" class="package-list">
              <div v-for="file in createSkillForm.files" :key="getFileId(file)" class="package-list__item">
                <span class="package-list__name" :title="file.originalName">{{ file.originalName }}</span>
                <el-button
                  :loading="deletingPackageId === getFileId(file)"
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
        <el-button type="primary" :disabled="!canPublishSkill" :loading="publishingSkill" @click="submitSkill">
          {{ skillSubmitText }}
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete, RefreshRight } from '@element-plus/icons-vue';

import { CREATESKILL, FILE_DELETE, FILE_DOWNLOAD, FILE_UPLOAD, SKILL_DELETE, SKILL_LIST, SKILL_UPDATE } from '@/request/constant';
import { reportBusinessEvent } from '@/request/service';
import { download, get, post, upload } from '@/request/webservice';
import { useUserStore } from '@/store';
import downloadHighIcon from '@/assets/download_high.svg';
import downloadNormalIcon from '@/assets/download_normal.svg';
import moreIcon from '@/assets/more.svg';
import skillUsageHotIcon from '@/assets/hot.svg';

const userStore = useUserStore();
const skills = ref([]);

const skillPublishCategories = ['通用与办公', '邮件与沟通', '会议与日程', '搜索与信息查询', '数据分析', '其他'];
const initialCreateSkillForm = () => ({
  id: '',
  title: '',
  name: '',
  description: '',
  type: '',
  files: []
});

const loadingSkills = ref(false);
const createSkillVisible = ref(false);
const packageInputRef = ref(null);
const uploadingPackage = ref(false);
const deletingPackageId = ref('');
const deletingSkillId = ref('');
const publishingSkill = ref(false);
const editingSkillId = ref('');
const pendingDeletedPackageFiles = ref([]);
const createSkillForm = reactive(initialCreateSkillForm());
const downloadVisible = ref(false);
const activeSkill = ref(null);
const downloadingFileId = ref('');
const downloadEventReported = ref(false);

const hasUploadedPackage = computed(() => createSkillForm.files.length > 0);
const isEditingSkill = computed(() => Boolean(editingSkillId.value));
const skillDialogTitle = computed(() => (isEditingSkill.value ? '更新技能' : '创建技能'));
const skillSubmitText = computed(() => (isEditingSkill.value ? '确认更新' : '确认发布'));
const canPublishSkill = computed(() => {
  return Boolean(
    createSkillForm.title
      && createSkillForm.name
      && createSkillForm.description
      && createSkillForm.type
      && (!isEditingSkill.value || createSkillForm.id)
      && hasUploadedPackage.value
      && !uploadingPackage.value
      && !deletingPackageId.value
      && !publishingSkill.value
  );
});
const downloadFiles = computed(() => activeSkill.value?.files || []);

const normalizeSkillList = (data) => (Array.isArray(data) ? data : []);
const getSkillId = (skill = {}) => skill.id || skill._id || '';
const getFileId = (file = {}) => file.id || file.fileId || '';
const getSkillReportLogic = (skill = {}) => [getSkillId(skill), skill.title || '', skill.name || ''].join('|');
const normalizeIdentity = (value) => String(value ?? '').trim();
const normalizeRole = (value) => normalizeIdentity(value).toLowerCase();
const normalizeFiles = (files) => (Array.isArray(files) ? files.map((file) => ({ ...file })) : []);
const normalizeCount = (value) => {
  const count = Number(value);

  return Number.isFinite(count) && count > 0 ? count : 0;
};
const getDisplayValue = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'object') {
    return normalizeIdentity(value.name || value.nickname || value.username || value.employeeNumber || value.id || value._id);
  }

  return normalizeIdentity(value);
};
const getSkillUsageCount = (skill = {}) => {
  return normalizeCount(
    skill.usageCount
      ?? skill.usage_count
      ?? skill.useCount
      ?? skill.use_count
      ?? skill.usedCount
      ?? skill.used_count
      ?? skill.downloadCount
      ?? skill.download_count
      ?? skill.downloads
      ?? skill.count
  );
};
const formatUsageCount = (count) => {
  const normalizedCount = normalizeCount(count);

  if (normalizedCount >= 10000) {
    const formattedCount = (normalizedCount / 10000).toFixed(1).replace(/\.0$/, '');

    return `${formattedCount}万`;
  }

  return String(normalizedCount);
};
const getSkillAuthorText = (skill = {}) => {
  const author = getDisplayValue(skill.author || skill.authorName || skill.owner || skill.ownerName);
  const creator = getDisplayValue(skill.creator ?? skill.creatorId ?? skill.createdBy);

  if (!author && !creator) {
    return '';
  }

  return `@${author || creator}${creator && creator !== author ? ` ${creator}` : ''}`;
};

const isAdmin = computed(() => ['admin', '管理员'].includes(normalizeRole(userStore.role)));
const currentUserIdentities = computed(() => {
  return [userStore.id, userStore.employeeNumber, userStore.name]
    .map(normalizeIdentity)
    .filter(Boolean);
});

const getCreatorIdentities = (skill = {}) => {
  const creator = skill.creator ?? skill.creatorId ?? skill.createdBy;

  if (!creator) {
    return [];
  }

  if (typeof creator === 'object') {
    return [creator.id, creator._id, creator.employeeNumber, creator.name]
      .map(normalizeIdentity)
      .filter(Boolean);
  }

  return [normalizeIdentity(creator)].filter(Boolean);
};

const canManageSkill = (skill) => {
  if (isAdmin.value) {
    return true;
  }

  const creatorIdentities = getCreatorIdentities(skill);

  return creatorIdentities.some((identity) => currentUserIdentities.value.includes(identity));
};

const loadSkills = () => {
  loadingSkills.value = true;
  get(SKILL_LIST, {}, (data, error) => {
    loadingSkills.value = false;

    if (error) {
      ElMessage.error('技能列表获取失败');
      return;
    }

    skills.value = normalizeSkillList(data);
  });
};

const resetCreateSkillForm = () => {
  editingSkillId.value = '';
  pendingDeletedPackageFiles.value = [];
  Object.assign(createSkillForm, initialCreateSkillForm());
  if (packageInputRef.value) {
    packageInputRef.value.value = '';
  }
};

const openCreateSkillDialog = () => {
  editingSkillId.value = '';
  pendingDeletedPackageFiles.value = [];
  Object.assign(createSkillForm, initialCreateSkillForm());
  createSkillVisible.value = true;
};

const openUpdateSkillDialog = (skill) => {
  const skillId = getSkillId(skill);

  if (!skillId) {
    ElMessage.error('技能信息缺少 ID，无法更新');
    return;
  }

  editingSkillId.value = skillId;
  pendingDeletedPackageFiles.value = [];
  Object.assign(createSkillForm, {
    id: skillId,
    title: skill.title || '',
    name: skill.name || '',
    description: skill.description || '',
    type: skill.type || '',
    files: normalizeFiles(skill.files)
  });
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

const removeFileFromForm = (file) => {
  const fileId = getFileId(file);
  createSkillForm.files = createSkillForm.files.filter((item) => getFileId(item) !== fileId);
};

const deletePackageFiles = (files = []) => {
  const fileIds = files.map(getFileId).filter(Boolean);

  if (fileIds.length === 0) {
    return Promise.resolve();
  }

  return post(FILE_DELETE, { files: fileIds });
};

const deletePackageFile = (file) => {
  const fileId = getFileId(file);

  if (!fileId) {
    ElMessage.error('技能包信息缺少文件 ID，无法删除');
    return;
  }

  if (isEditingSkill.value) {
    if (!pendingDeletedPackageFiles.value.some((item) => getFileId(item) === fileId)) {
      pendingDeletedPackageFiles.value.push({ ...file });
    }

    removeFileFromForm(file);
    ElMessage.success('技能包已从本次更新中移除，确认更新后同步删除');
    return;
  }

  deletingPackageId.value = fileId;
  deletePackageFiles([file])
    .then(() => {
      removeFileFromForm(file);
      ElMessage.success('技能包已删除');
    })
    .catch(() => {
      ElMessage.error('技能包删除失败');
    })
    .finally(() => {
      deletingPackageId.value = '';
    });
};

const deletePendingPackageFiles = () => deletePackageFiles(pendingDeletedPackageFiles.value);

const submitSkill = async () => {
  if (!canPublishSkill.value) {
    return;
  }

  const { id, title, name, description, type, files } = createSkillForm;
  const isUpdate = isEditingSkill.value;
  const path = isUpdate ? SKILL_UPDATE : CREATESKILL;
  const payload = isUpdate ? { id, title, name, description, type, files } : { title, name, description, type, files };

  publishingSkill.value = true;

  try {
    if (isUpdate && pendingDeletedPackageFiles.value.length > 0) {
      await deletePendingPackageFiles();
    }

    await post(path, payload);
    ElMessage.success(isUpdate ? '技能更新成功' : '技能发布成功');
    pendingDeletedPackageFiles.value = [];
    createSkillVisible.value = false;
    loadSkills();
  } catch (error) {
    ElMessage.error(isUpdate ? '技能更新失败' : '技能发布失败');
  } finally {
    publishingSkill.value = false;
  }
};

const handleDeleteSkill = async (skill) => {
  const skillId = getSkillId(skill);

  if (!skillId) {
    ElMessage.error('技能信息缺少 ID，无法删除');
    return;
  }

  if (deletingSkillId.value) {
    return;
  }

  try {
    await ElMessageBox.confirm(`确认删除技能「${skill.title || skill.name || skillId}」吗？`, '删除技能', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });

    deletingSkillId.value = skillId;
    await post(SKILL_DELETE, { id: skillId });
    ElMessage.success('技能删除成功');
    loadSkills();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('技能删除失败');
    }
  } finally {
    deletingSkillId.value = '';
  }
};

const openDownloadDialog = (skill) => {
  activeSkill.value = skill;
  downloadEventReported.value = false;
  downloadVisible.value = true;
};

const reportSkillDownload = () => {
  if (downloadEventReported.value) {
    return;
  }

  downloadEventReported.value = true;
  reportBusinessEvent('skill', getSkillReportLogic(activeSkill.value)).catch((error) => {
    console.warn('技能下载事件上报失败', error);
  });
};

const downloadFile = (file) => {
  if (downloadingFileId.value) {
    return;
  }

  if (!file?.id || !(file.originalName || file.name)) {
    ElMessage.error('文件信息不完整，无法下载');
    return;
  }

  downloadingFileId.value = file.id;
  download(FILE_DOWNLOAD, { id: file.id, name: file.originalName || file.name }, (data, error) => {
    downloadingFileId.value = '';

    if (error) {
      ElMessage.error('文件下载失败');
      return;
    }

    reportSkillDownload();
    ElMessage.success('文件下载已开始');
  });
};

onMounted(loadSkills);
</script>
