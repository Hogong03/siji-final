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
    description: '智能更新用户画像。用户在对话中透露新偏好/事实时调用，支持任意自定义属性（如 MBTI、星座、血型等），未知属性会自动新建分组保存。',
    parameters: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          description: '要写入的字段列表：card 为已有分组 id（basic/lifestyle/custom_ai）或直接写新分组名（自动创建）；field 为已知字段（nickname/gender/birthday/occupation/location/bio/budget/sleepTime/hobbies/dietary）或任意自定义属性名（如 MBTI、星座、血型）；value 为属性值。用户主动告知的新属性必须记录，只更新用户本次提到的字段，未提及的旧字段禁止重复上报。',
          items: {
            type: 'object',
            properties: {
              card: { type: 'string', description: '分组 id 或新分组名，如 basic、custom_ai、性格特征' },
              field: { type: 'string', description: '字段名：已知字段或任意自定义属性，如 MBTI、星座、血型' },
              value: { description: '字段值，字符串或数组' }
            },
            required: ['card', 'field', 'value']
          }
        }
      },
      required: ['updates']
    }
  },
]
