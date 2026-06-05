<template>
  <section class="workspace-panel">
    <div class="workspace-panel__header">
      <div>
        <p>模型商店</p>
        <h1>模型资产与 AppKey</h1>
      </div>
      <el-button class="primary-action" type="primary" round @click="openCreateModelDialog">＋ 增加模型</el-button>
    </div>

    <div v-loading="loadingModels" class="asset-grid asset-grid--half">
      <article v-for="model in portal.models" :key="getModelId(model) || model.title || model.name" class="asset-card model-card">
        <img class="asset-card__icon model-card__icon" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="模型图标占位" />
        <div class="model-card__topline">
          <h3>{{ model.title || model.name }}</h3>
        </div>
        <p>{{ model.description }}</p>
        <div class="model-card__models">
          <span v-for="item in getModelItems(model)" :key="item">{{ item }}</span>
        </div>
        <div class="model-url">
          <span>调用 URL</span>
          <code>{{ getModelUrl(model) || '暂无地址' }}</code>
          <el-button size="small" type="primary" plain @click="copyModelUrl(getModelUrl(model))">复制</el-button>
        </div>
        <div class="app-key">
          <span>AppKey</span>
          <code>{{ getModelAppKey(model) }}</code>
          <el-button size="small" type="primary" plain @click="copyAppKey(getModelAppKey(model))">复制</el-button>
        </div>
        <div class="model-card__actions" v-if="canManageModel(model)">
          <el-button type="warning" plain round @click="openUpdateModelDialog(model)">更新</el-button>
          <el-button
            :loading="deletingModelId === getModelId(model)"
            type="danger"
            plain
            round
            @click="handleDeleteModel(model)"
          >
            删除
          </el-button>
        </div>
      </article>
    </div>

    <el-empty v-if="!loadingModels && portal.models.length === 0" description="暂无模型资产" />

    <el-dialog v-model="modelDialogVisible" :title="modelDialogTitle" width="560px" align-center @closed="resetModelForm">
      <el-form class="create-model-form" label-position="top">
        <el-form-item label="名称" required>
          <el-input v-model.trim="modelForm.title" placeholder="输入模型名称" />
        </el-form-item>
        <el-form-item label="描述" required>
          <el-input v-model.trim="modelForm.description" placeholder="输入模型描述" :rows="4" type="textarea" />
        </el-form-item>
        <el-form-item label="地址" required>
          <el-input v-model.trim="modelForm.url" placeholder="输入模型地址" />
        </el-form-item>
        <el-form-item label="模型" required>
          <el-input v-model.trim="modelForm.models" placeholder="输入模型名称，多个模型名称以,分割" />
        </el-form-item>
        <el-form-item label="秘钥" required>
          <el-input v-model.trim="modelForm.app_key" placeholder="输入模型秘钥" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="modelDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!canSubmitModel" :loading="submittingModel" @click="submitModel">
          {{ modelSubmitText }}
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { MODEL_CREATE, MODEL_DELETE, MODEL_STORE_LIST, MODEL_UPDATE } from '@/request/constant';
import { get, post } from '@/request/webservice';
import { useUserStore } from '@/store';
import { usePortalStore } from '@/stores/portal';

const portal = usePortalStore();
const userStore = useUserStore();

const initialModelForm = () => ({
  id: '',
  title: '',
  description: '',
  url: '',
  models: '',
  app_key: ''
});

const loadingModels = ref(false);
const modelDialogVisible = ref(false);
const submittingModel = ref(false);
const deletingModelId = ref('');
const editingModelId = ref('');
const modelForm = reactive(initialModelForm());

const isEditingModel = computed(() => Boolean(editingModelId.value));
const modelDialogTitle = computed(() => (isEditingModel.value ? '更新模型' : '增加模型'));
const modelSubmitText = computed(() => (isEditingModel.value ? '确认更新' : '确认增加'));
const canSubmitModel = computed(() => {
  return Boolean(
    modelForm.title
      && modelForm.description
      && modelForm.url
      && modelForm.models
      && modelForm.app_key
      && (!isEditingModel.value || modelForm.id)
      && !submittingModel.value
  );
});

const normalizeModelList = (data) => (Array.isArray(data) ? data : []);
const getModelId = (model = {}) => model.id || model._id || '';
const normalizeIdentity = (value) => String(value ?? '').trim();
const normalizeRole = (value) => normalizeIdentity(value).toLowerCase();
const normalizeModels = (models) => {
  if (Array.isArray(models)) {
    return models.map(normalizeIdentity).filter(Boolean);
  }

  return String(models || '')
    .split(/[，,\n]/)
    .map(normalizeIdentity)
    .filter(Boolean);
};

const getModelItems = (model = {}) => normalizeModels(model.models || model.supportedModels);
const getModelAppKey = (model = {}) => model.app_key || model.appKey || '';
const getModelUrl = (model = {}) => model.url || model.link || '';

const isAdmin = computed(() => ['admin', '管理员'].includes(normalizeRole(userStore.role)));
const currentUserIdentities = computed(() => {
  return [userStore.id, userStore.employeeNumber, userStore.name]
    .map(normalizeIdentity)
    .filter(Boolean);
});

const getCreatorIdentities = (model = {}) => {
  const creator = model.creator ?? model.creatorId ?? model.createdBy;

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

const canManageModel = (model) => {
  if (isAdmin.value) {
    return true;
  }

  const creatorIdentities = getCreatorIdentities(model);

  return creatorIdentities.some((identity) => currentUserIdentities.value.includes(identity));
};

const loadModels = () => {
  loadingModels.value = true;
  get(MODEL_STORE_LIST, {}, (data, error) => {
    loadingModels.value = false;

    if (error) {
      ElMessage.error('模型列表获取失败');
      return;
    }

    portal.setModels(normalizeModelList(data));
  });
};

const resetModelForm = () => {
  editingModelId.value = '';
  Object.assign(modelForm, initialModelForm());
};

const openCreateModelDialog = () => {
  editingModelId.value = '';
  Object.assign(modelForm, initialModelForm());
  modelDialogVisible.value = true;
};

const openUpdateModelDialog = (model) => {
  const modelId = getModelId(model);

  if (!modelId) {
    ElMessage.error('模型信息缺少 ID，无法更新');
    return;
  }

  editingModelId.value = modelId;
  Object.assign(modelForm, {
    id: modelId,
    title: model.title || model.name || '',
    description: model.description || '',
    url: getModelUrl(model),
    models: getModelItems(model).join(','),
    app_key: getModelAppKey(model)
  });
  modelDialogVisible.value = true;
};

const submitModel = async () => {
  if (!canSubmitModel.value) {
    return;
  }

  const { id, title, app_key, description, models, url } = modelForm;
  const isUpdate = isEditingModel.value;
  const path = isUpdate ? MODEL_UPDATE : MODEL_CREATE;
  const payload = isUpdate ? { id, title, app_key, description, models, url } : { title, app_key, description, models, url };

  submittingModel.value = true;

  try {
    await post(path, payload);
    ElMessage.success(isUpdate ? '模型更新成功' : '模型增加成功');
    modelDialogVisible.value = false;
    loadModels();
  } catch (error) {
    ElMessage.error(isUpdate ? '模型更新失败' : '模型增加失败');
  } finally {
    submittingModel.value = false;
  }
};

const handleDeleteModel = async (model) => {
  const modelId = getModelId(model);

  if (!modelId) {
    ElMessage.error('模型信息缺少 ID，无法删除');
    return;
  }

  if (deletingModelId.value) {
    return;
  }

  try {
    await ElMessageBox.confirm(`确认删除模型「${model.title || model.name || modelId}」吗？`, '删除模型', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });

    deletingModelId.value = modelId;
    await post(MODEL_DELETE, { id: modelId });
    ElMessage.success('模型删除成功');
    loadModels();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('模型删除失败');
    }
  } finally {
    deletingModelId.value = '';
  }
};

const copyText = async (text, emptyMessage, successMessage) => {
  if (!text) {
    ElMessage.error(emptyMessage);
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }

  ElMessage.success(successMessage);
};

const copyModelUrl = (url) => copyText(url, '调用 URL 为空，无法复制', '调用 URL 已复制');

const copyAppKey = (appKey) => copyText(appKey, 'AppKey 为空，无法复制', 'AppKey 已复制');

onMounted(loadModels);
</script>
