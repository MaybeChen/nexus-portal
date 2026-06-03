<template>
  <section class="workspace-panel">
    <div class="workspace-panel__header">
      <div>
        <p>Skill Hub</p>
        <h1>可复用技能资产</h1>
      </div>
      <el-button type="primary" round @click="openCreateSkillDialog">发布技能</el-button>
    </div>

    <div v-loading="loadingSkills" class="asset-grid asset-grid--quarter">
      <article v-for="skill in portal.skills" :key="skill.id || skill.name" class="asset-card skill-card">
        <el-tag class="skill-card__type" type="primary" effect="light">{{ skill.type || '未分类' }}</el-tag>
        <div class="skill-card__content">
          <span class="skill-card__title">{{ skill.title || skill.name }}</span>
          <h3>{{ skill.name }}</h3>
          <p>{{ skill.description }}</p>
        </div>
        <div class="skill-card__actions">
          <el-button type="primary" plain round @click="openDownloadDialog(skill)">下载</el-button>
          <template v-if="canManageSkill(skill)">
            <el-button type="warning" plain round @click="openUpdateSkillDialog(skill)">更新</el-button>
            <el-button
              :loading="deletingSkillId === getSkillId(skill)"
              type="danger"
              plain
              round
              @click="deleteSkill(skill)"
            >
              删除
            </el-button>
          </template>
        </div>
      </article>
    </div>

    <el-empty v-if="!loadingSkills && portal.skills.length === 0" description="暂无技能资产" />

    <el-dialog v-model="downloadVisible" :title="`${activeSkill?.title || activeSkill?.name || '技能'} 文件列表`" width="520px" align-center>
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

    <el-dialog v-model="createSkillVisible" :title="skillDialogTitle" width="560px" align-center @closed="resetCreateSkillForm">
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

import { CREATESKILL, FILE_DELETE, FILE_DOWNLOAD, FILE_UPLOAD, SKILL_DELETE, SKILL_LIST, SKILL_UPDATE } from '@/request/constant';
import { del, download, get, post, upload } from '@/request/webservice';
import { useUserStore } from '@/store';
import { usePortalStore } from '@/stores/portal';

const portal = usePortalStore();
const userStore = useUserStore();

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
const createSkillForm = reactive(initialCreateSkillForm());
const downloadVisible = ref(false);
const activeSkill = ref(null);
const downloadingFileId = ref('');

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
const normalizeIdentity = (value) => String(value ?? '').trim();
const normalizeRole = (value) => normalizeIdentity(value).toLowerCase();
const normalizeFiles = (files) => (Array.isArray(files) ? files.map((file) => ({ ...file })) : []);

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

    portal.setSkills(normalizeSkillList(data));
  });
};

const resetCreateSkillForm = () => {
  editingSkillId.value = '';
  Object.assign(createSkillForm, initialCreateSkillForm());
  if (packageInputRef.value) {
    packageInputRef.value.value = '';
  }
};

const openCreateSkillDialog = () => {
  editingSkillId.value = '';
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

const submitSkill = () => {
  if (!canPublishSkill.value) {
    return;
  }

  const { id, title, name, description, type, files } = createSkillForm;
  const isUpdate = isEditingSkill.value;
  const path = isUpdate ? SKILL_UPDATE : CREATESKILL;
  const payload = isUpdate ? { id, title, name, description, type, files } : { title, name, description, type, files };

  publishingSkill.value = true;
  post(path, payload, (_, error) => {
    publishingSkill.value = false;

    if (error) {
      ElMessage.error(isUpdate ? '技能更新失败' : '技能发布失败');
      return;
    }

    ElMessage.success(isUpdate ? '技能更新成功' : '技能发布成功');
    createSkillVisible.value = false;
    loadSkills();
  });
};

const deleteSkill = (skill) => {
  const skillId = getSkillId(skill);

  if (!skillId) {
    ElMessage.error('技能信息缺少 ID，无法删除');
    return;
  }

  ElMessageBox.confirm(`确认删除技能「${skill.title || skill.name || skillId}」吗？`, '删除技能', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  })
    .then(() => {
      deletingSkillId.value = skillId;
      del(SKILL_DELETE, { id: skillId }, (_, error) => {
        deletingSkillId.value = '';

        if (error) {
          ElMessage.error('技能删除失败');
          return;
        }

        ElMessage.success('技能删除成功');
        loadSkills();
      });
    })
    .catch(() => {});
};

const openDownloadDialog = (skill) => {
  activeSkill.value = skill;
  downloadVisible.value = true;
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

    ElMessage.success('文件下载已开始');
  });
};

onMounted(loadSkills);
</script>
