<template>
  <section class="workspace-panel">
    <div class="workspace-panel__header">
      <div>
        <p>AI工具</p>
      </div>
      <el-button class="primary-action" type="primary" round @click="openCreateToolDialog">＋ 创建工具</el-button>
    </div>


    <div v-loading="loadingTools" class="asset-grid asset-grid--quarter">
      <article v-for="tool in tools" :key="getToolId(tool) || tool.title" class="asset-card tool-card">
        <el-tag class="tool-card__type" type="success" effect="light">{{ tool.type || '未分类' }}</el-tag>
        <div class="tool-card__content">
          <h3>{{ tool.title || tool.name }}</h3>
          <p>{{ tool.description }}</p>
        </div>
        <div class="tool-card__footer">
          <div class="tool-card__meta">
            <span class="tool-card__usage">
              <img class="tool-card__usage-icon" :src="toolUsageHotIcon" alt="" aria-hidden="true" />
              {{ formatUsageCount(getToolUsageCount(tool)) }} 次使用
            </span>
            <span v-if="getToolAuthorText(tool)" class="tool-card__author" :title="getToolAuthorText(tool)">
              · {{ getToolAuthorText(tool) }}
            </span>
          </div>
          <div class="tool-card__actions">
            <el-button class="tool-card__use" type="success" plain round @click="useTool(tool)">
              <el-icon><Promotion /></el-icon>
              <span>使用</span>
            </el-button>
            <el-dropdown v-if="canManageTool(tool)" trigger="click" placement="bottom-end">
              <el-button class="tool-card__more" aria-label="更多操作">
                <img class="tool-card__more-icon" :src="moreIcon" alt="" aria-hidden="true" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openUpdateToolDialog(tool)">
                    <el-icon><RefreshRight /></el-icon>
                    <span>更新</span>
                  </el-dropdown-item>
                  <el-dropdown-item
                    :disabled="Boolean(deletingToolId)"
                    @click="handleDeleteTool(tool)"
                  >
                    <el-icon><Delete /></el-icon>
                    <span>{{ deletingToolId === getToolId(tool) ? '删除中' : '删除' }}</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </article>
    </div>

    <el-empty v-if="!loadingTools && tools.length === 0" description="暂无 AI 工具" />

    <el-dialog v-model="toolDialogVisible" :title="toolDialogTitle" width="560px" append-to-body align-center @closed="resetToolForm">
      <el-form class="create-tool-form" label-position="top">
        <el-form-item label="名称" required>
          <el-input v-model.trim="toolForm.title" placeholder="输入工具名称" />
        </el-form-item>
        <el-form-item label="描述" required>
          <el-input v-model.trim="toolForm.description" placeholder="输入工具描述" :rows="4" type="textarea" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="toolForm.type" placeholder="选择工具类型">
            <el-option v-for="category in toolTypeOptions" :key="category" :label="category" :value="category" />
          </el-select>
        </el-form-item>
        <el-form-item label="工具地址" required>
          <el-input v-model.trim="toolForm.link" placeholder="输入工具访问地址" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="toolDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!canSubmitTool" :loading="submittingTool" @click="submitTool">
          {{ toolSubmitText }}
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete, Promotion, RefreshRight } from '@element-plus/icons-vue';

import { AI_TOOL_CREATE, AI_TOOL_DELETE, AI_TOOL_LIST, AI_TOOL_UPDATE, AI_TOOL_USED } from '@/request/constant';
import { get, post } from '@/request/webservice';
import { useUserStore } from '@/store';
import moreIcon from '@/assets/more.svg';
import toolUsageHotIcon from '@/assets/hot.svg';

const userStore = useUserStore();
const tools = ref([]);

const toolTypeOptions = ['通用与办公', '邮件与沟通', '会议与日程', '搜索与信息查询', '数据分析', '其他'];
const initialToolForm = () => ({
  id: '',
  title: '',
  description: '',
  type: '',
  link: ''
});

const loadingTools = ref(false);
const toolDialogVisible = ref(false);
const submittingTool = ref(false);
const deletingToolId = ref('');
const editingToolId = ref('');
const toolForm = reactive(initialToolForm());

const isEditingTool = computed(() => Boolean(editingToolId.value));
const toolDialogTitle = computed(() => (isEditingTool.value ? '更新工具' : '创建工具'));
const toolSubmitText = computed(() => (isEditingTool.value ? '确认更新' : '确认创建'));
const canSubmitTool = computed(() => {
  return Boolean(
    toolForm.title
      && toolForm.description
      && toolForm.type
      && toolForm.link
      && (!isEditingTool.value || toolForm.id)
      && !submittingTool.value
  );
});

const normalizeToolList = (data) => (Array.isArray(data) ? data : []);
const getToolId = (tool = {}) => tool.id || tool._id || '';
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
const getToolUsageCount = (tool = {}) => {
  return normalizeCount(
    tool.used
      ?? tool.usageCount
      ?? tool.usage_count
      ?? tool.useCount
      ?? tool.use_count
      ?? tool.usedCount
      ?? tool.used_count
      ?? tool.count
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
const getToolAuthorText = (tool = {}) => {
  const author = getDisplayValue(tool.author || tool.authorName || tool.owner || tool.ownerName);
  const creator = getDisplayValue(tool.creator ?? tool.creatorId ?? tool.createdBy);

  return author || creator;
};
const incrementToolUsed = (tool = {}) => {
  const toolId = getToolId(tool);
  const nextUsed = getToolUsageCount(tool) + 1;
  tool.used = nextUsed;

  const matchedTool = tools.value.find((item) => item === tool || (toolId && getToolId(item) === toolId));

  if (matchedTool && matchedTool !== tool) {
    matchedTool.used = nextUsed;
  }
};

const isAdmin = computed(() => ['admin', '管理员'].includes(normalizeRole(userStore.role)));
const currentUserIdentities = computed(() => {
  return [userStore.id, userStore.employeeNumber, userStore.name]
    .map(normalizeIdentity)
    .filter(Boolean);
});

const getCreatorIdentities = (tool = {}) => {
  const creator = tool.creator ?? tool.creatorId ?? tool.createdBy;

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

const canManageTool = (tool) => {
  if (isAdmin.value) {
    return true;
  }

  const creatorIdentities = getCreatorIdentities(tool);

  return creatorIdentities.some((identity) => currentUserIdentities.value.includes(identity));
};

const loadTools = () => {
  loadingTools.value = true;
  get(AI_TOOL_LIST, {}, (data, error) => {
    loadingTools.value = false;

    if (error) {
      ElMessage.error('AI 工具列表获取失败');
      return;
    }

    tools.value = normalizeToolList(data);
  });
};

const resetToolForm = () => {
  editingToolId.value = '';
  Object.assign(toolForm, initialToolForm());
};

const openCreateToolDialog = () => {
  editingToolId.value = '';
  Object.assign(toolForm, initialToolForm());
  toolDialogVisible.value = true;
};

const openUpdateToolDialog = (tool) => {
  const toolId = getToolId(tool);

  if (!toolId) {
    ElMessage.error('工具信息缺少 ID，无法更新');
    return;
  }

  editingToolId.value = toolId;
  Object.assign(toolForm, {
    id: toolId,
    title: tool.title || tool.name || '',
    description: tool.description || '',
    type: tool.type || '',
    link: tool.link || ''
  });
  toolDialogVisible.value = true;
};

const submitTool = async () => {
  if (!canSubmitTool.value) {
    return;
  }

  const { id, title, description, type, link } = toolForm;
  const isUpdate = isEditingTool.value;
  const path = isUpdate ? AI_TOOL_UPDATE : AI_TOOL_CREATE;
  const payload = isUpdate ? { id, title, link, description, type } : { title, link, description, type };

  submittingTool.value = true;

  try {
    await post(path, payload);
    ElMessage.success(isUpdate ? '工具更新成功' : '工具创建成功');
    toolDialogVisible.value = false;
    loadTools();
  } catch (error) {
    ElMessage.error(isUpdate ? '工具更新失败' : '工具创建失败');
  } finally {
    submittingTool.value = false;
  }
};

const handleDeleteTool = async (tool) => {
  const toolId = getToolId(tool);

  if (!toolId) {
    ElMessage.error('工具信息缺少 ID，无法删除');
    return;
  }

  if (deletingToolId.value) {
    return;
  }

  try {
    await ElMessageBox.confirm(`确认删除工具「${tool.title || tool.name || toolId}」吗？`, '删除工具', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });

    deletingToolId.value = toolId;
    await post(AI_TOOL_DELETE, { id: toolId });
    ElMessage.success('工具删除成功');
    loadTools();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('工具删除失败');
    }
  } finally {
    deletingToolId.value = '';
  }
};

const reportToolUsed = (tool = {}) => {
  const toolId = getToolId(tool);

  if (!toolId) {
    return;
  }

  post(AI_TOOL_USED, { id: toolId })
    .then(() => {
      incrementToolUsed(tool);
    })
    .catch((error) => {
      console.warn('工具使用次数上报失败', error);
    });
};

const useTool = (tool) => {
  if (!tool.link) {
    ElMessage.error('工具地址为空，无法跳转');
    return;
  }

  reportToolUsed(tool);
  window.open(tool.link, '_blank', 'noopener,noreferrer');
};

onMounted(loadTools);
</script>
