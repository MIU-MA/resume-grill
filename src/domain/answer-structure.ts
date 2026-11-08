export function answerStructure(text: string) {
  return [
    { label: '背景', mentioned: /当时|背景|业务|场景|项目|需求/.test(text) },
    { label: '目标', mentioned: /目标|需要|希望|解决|要求|为了/.test(text) },
    { label: '个人动作', mentioned: /我|负责|实现|设计|排查|选择|调整|验证/.test(text) },
    { label: '结果与证据', mentioned: /结果|最终|观察|对比|测试|监控|降低|提升|减少|增加/.test(text) },
  ]
}
