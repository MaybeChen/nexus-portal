export const NEXUS_API_PREFIX = '/nexus/api';
export const API_PREFIX = NEXUS_API_PREFIX;

export const STATUS_CODE = {
  SUCCESS: 200, // 成功
  BAD_REQUEST: 400, // 参数错误
  UNAUTHORIZED: 401, // 鉴权失败
  SERVER_ERROR: 500 // 业务处理异常
};

export const X_WA_TOKEN = 'x-wa-token';

export const CREATESKILL = '/skills/create';
export const SKILL_UPDATE = '/skills/update';
export const SKILL_DELETE = '/skills/delete';
export const SKILL_LIST = '/skills/list';
export const AI_TOOL_CREATE = '/tool/create';
export const AI_TOOL_UPDATE = '/tool/update';
export const AI_TOOL_DELETE = '/tool/delete';
export const AI_TOOL_LIST = '/tool/list';
export const MODEL_CREATE = '/model/create';
export const MODEL_UPDATE = '/model/update';
export const MODEL_DELETE = '/model/delete';
export const MODEL_STORE_LIST = '/model/list';
export const FILE_UPLOAD = '/files/upload';
export const FILE_DELETE = '/files/delete';
export const FILE_DOWNLOAD = '/files/download';
export const USER_INFO = '/me';
export const EVENT_UPLOAD = '/event/upload';
