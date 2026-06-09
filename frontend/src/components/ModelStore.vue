<template>
  <section class="workspace-panel">
    <div class="workspace-panel__header">
      <div>
        <p>模型商店</p>
      </div>
      <el-button class="primary-action" type="primary" round @click="openCreateModelDialog">＋ 增加模型</el-button>
    </div>

    <div v-loading="loadingModels" class="asset-grid asset-grid--half">
      <article v-for="model in models" :key="getModelId(model) || model.title || model.name" class="asset-card model-card">
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
          <el-button size="small" type="primary" plain @click="copyModelUrl(getModelUrl(model))">
            <el-icon><CopyDocument /></el-icon>
            <span>复制</span>
          </el-button>
        </div>
        <div class="app-key">
          <span>apikey</span>
          <code>{{ getModelAppKey(model) }}</code>
          <el-button size="small" type="primary" plain @click="copyAppKey(model)">
            <el-icon><CopyDocument /></el-icon>
            <span>复制</span>
          </el-button>
        </div>
        <div class="model-card__footer">
          <div class="model-card__meta">
            <span class="model-card__usage">
              <img class="model-card__usage-icon" :src="modelUsageHotIcon" alt="" aria-hidden="true" />
              {{ formatUsageCount(getModelUsageCount(model)) }} 次使用
            </span>
            <span v-if="getModelAuthorText(model)" class="model-card__author" :title="getModelAuthorText(model)">
              · {{ getModelAuthorText(model) }}
            </span>
          </div>
          <div class="model-card__actions" v-if="canManageModel(model)">
            <el-dropdown trigger="click" placement="bottom-end">
              <el-button class="model-card__more" aria-label="更多操作">
                <img class="model-card__more-icon" :src="moreIcon" alt="" aria-hidden="true" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openUpdateModelDialog(model)">
                    <el-icon><RefreshRight /></el-icon>
                    <span>更新</span>
                  </el-dropdown-item>
                  <el-dropdown-item
                    :disabled="Boolean(deletingModelId)"
                    @click="handleDeleteModel(model)"
                  >
                    <el-icon><Delete /></el-icon>
                    <span>{{ deletingModelId === getModelId(model) ? '删除中' : '删除' }}</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </article>
    </div>

    <el-empty v-if="!loadingModels && models.length === 0" description="暂无模型资产" />

    <el-dialog v-model="modelDialogVisible" :title="modelDialogTitle" width="560px" append-to-body align-center @closed="resetModelForm">
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
import { CopyDocument, Delete, RefreshRight } from '@element-plus/icons-vue';

import { MODEL_CREATE, MODEL_DELETE, MODEL_STORE_LIST, MODEL_UPDATE, MODEL_USED } from '@/request/constant';
import { get, post } from '@/request/webservice';
import { useUserStore } from '@/store';
import moreIcon from '@/assets/more.svg';
import modelUsageHotIcon from '@/assets/hot.svg';

const userStore = useUserStore();
const models = ref([]);

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
const getModelUsageCount = (model = {}) => {
  return normalizeCount(
    model.used
      ?? model.usageCount
      ?? model.usage_count
      ?? model.useCount
      ?? model.use_count
      ?? model.usedCount
      ?? model.used_count
      ?? model.count
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
const getModelAuthorText = (model = {}) => {
  const author = getDisplayValue(model.author || model.authorName || model.owner || model.ownerName);
  const creator = getDisplayValue(model.creator ?? model.creatorId ?? model.createdBy);

  return author || creator;
};
const incrementModelUsed = (model = {}) => {
  const modelId = getModelId(model);
  const nextUsed = getModelUsageCount(model) + 1;
  model.used = nextUsed;

  const matchedModel = models.value.find((item) => item === model || (modelId && getModelId(item) === modelId));

  if (matchedModel && matchedModel !== model) {
    matchedModel.used = nextUsed;
  }
};
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

    models.value = normalizeModelList(data);
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
    return false;
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
  return true;
};

const reportModelUsed = (model = {}) => {
  const modelId = getModelId(model);

  if (!modelId) {
    return;
  }

  post(MODEL_USED, { id: modelId })
    .then(() => {
      incrementModelUsed(model);
    })
    .catch((error) => {
      console.warn('模型使用次数上报失败', error);
    });
};

const copyModelUrl = (url) => copyText(url, '调用 URL 为空，无法复制', '调用 URL 已复制');

const copyAppKey = async (model) => {
  const copied = await copyText(getModelAppKey(model), 'AppKey 为空，无法复制', 'AppKey 已复制');

  if (copied) {
    reportModelUsed(model);
  }
};

onMounted(loadModels);
</script>
