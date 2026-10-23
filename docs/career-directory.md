# 招聘官网目录维护记录

2026-10-23 新增 21 家，目录由 16 家增至 37 家。新增来源通过公司招聘页面、页面标题或同一官网的公开搜索索引核对，未向公司确认招聘状态，未提交申请。

目录保存公司招聘入口，由用户选择具体职位。下表中的前端岗位仅用于「有前端线索」筛选，不代表岗位仍然开放；本次没有按未知公司规模做分类。

## 新增招聘门户

| 公司 | 入口 | 本次核对情况 |
| --- | --- | --- |
| 快手 | https://zhaopin.kuaishou.cn/ | 招聘标题可识别，职位依赖脚本 |
| 滴滴 | https://talent.didiglobal.com/social/ | 公开职位列表可见 |
| 携程 | https://careers.trip.com/ | 招聘标题可识别，职位依赖脚本 |
| 虾皮 Shopee | https://careers.shopee.cn/ | 招聘页面可访问，静态正文不足 |
| 360 | https://hr.360.cn/hr/ | 由官方根路径跳转，职位依赖脚本 |
| 有赞 | https://job.youzan.com/ | 招聘标题可识别，静态正文不足 |
| 微盟 | https://job.weimob.com/talent/society/ | 招聘流程及投递说明可见 |
| 涂鸦智能 | https://job.tuya.com/ | 官方职位搜索入口可见 |
| PingCAP | https://www.pingcap.com/careers/ | 官方 Careers 页面，需按地区核对职位 |

## 新增前端线索

| 公司 | 官网入口 | 页面或官方索引中的线索 |
| --- | --- | --- |
| Ping++ | https://www.pingxx.com/career | 前端开发工程师 |
| Authing | https://www.authing.cn/joinus | 前端开发工程师，索引线索 |
| APUS | https://apuscn.com/cn/jobs | Web 前端研发工程师，索引线索 |
| Websoft9 | https://www.websoft9.com/careers/ | 前端开发、全栈工程师，索引线索 |
| 泡游网络 | https://www.xmpaoyou.com/job | web 前端开发 |
| 东道 | https://www.dongdao.net/join_us/ | web 前端工程师 |
| 绿雪智能 | https://www.greensnowai.com/job/ | 前端实习生、前端开发工程师 |
| 大汤圆技术 | https://www.datangyuan.cn/join-us | 软件工程师（前端 / 后端 / 全栈） |
| 炜荣 WEZON | https://www.wezonglobal.com/recruit | 前端开发工程师，职位依赖脚本，索引提供线索 |
| 画魂科技 | https://www.huahuntech.com/careers.html | 前端开发工程师 |
| 优码云 UMAYUN | https://www.umayun.com/careers | 高级前端工程师，React / Next.js |
| 星图维天信 | https://etapes.com.cn/contact/join.html | 前端开发工程师，索引线索 |

## 范围和维护

- 页面可打开与自动读取成功是两件事。依赖 JavaScript 的门户可能需要浏览器访问，原有的「粘贴正文补充」仍适用。
- 本次未收录出现读取失败、超时或重定向循环且未进一步确认的候选，如网易、金山办公、凌极、KOOK 等；不凭域名习惯补写入口。
- 原有 16 家沿用历史记录，本次未将其核对日期更新为 2026-10-23。原有采集快照 `data/career-leads/latest.*` 保持原来的抓取时间和内容。
- 维护入口在 `src/data/career-sites.ts`；工作台目录和求职助手共用同一份名单。助手单次最多选 8 个来源，目录数量不受此限制。
- 公司、英文别名、域名与已记录的岗位关键词都可搜索。「有前端线索」只筛选有公开线索的条目，不将综合招聘门户默认为前端在招。
