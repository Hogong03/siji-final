/**
 * tools/profile.js - PROFILE tool schemas (split from tools.js)
 */
export const PROFILE_TOOLS = [
  // ===== 个人信息 =====
  {
    name: 'get_profile',
    description: '读取用户画像（昵称/生日/职业/偏好等）。用户问"你知道我什么"或需要画像信息时调用。',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'smart_update_profile',
    description: '智能更新用户画像。用户在对话中透露新偏好/事实时调用。',
    parameters: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: { type: 'object', properties: { card: { type: 'string' }, field: { type: 'string' }, value: {} } }
        }
      },
      required: ['updates']
    }
  },
]
