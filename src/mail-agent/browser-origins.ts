// First-party recruiting hosts and public asset/CDN hosts used by these portals.
// Unknown user-supplied sites keep the DNS-pinned resource transport.
const PUBLIC_BROWSER_DOMAINS = ['bytedance.com', 'feishucdn.com', 'bytescm.com', 'bytednsdoc.com', 'byteimg.com', 'bytecdn.cn', 'bytedance.net', 'snssdk.com', 'pstatp.com', 'toutiao.com', 'alibaba.com', 'alicdn.com', 'aliyun.com', 'taotian.com', 'alipay.com', 'alipayobjects.com', 'meituan.com', 'dianping.com', 'sankuai.com', 'meituan.net', 'jd.com', '360buyimg.com', 'jcloudcs.com', 'baidu.com', 'bdstatic.com', 'bcebos.com', 'kuaishou.cn', 'kuaishou.com', 'kwaicdn.com', 'ksapisrv.com', 'kwai.com', 'didiglobal.com', 'didistatic.com', 'didichuxing.com']
export function trustedPublicBrowserHost(host: string) {
  return PUBLIC_BROWSER_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`))
}
export function browserRequestAllowed(url: URL, method: string, bodyBytes: number) {
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || bodyBytes > 1024 * 1024 || !['GET', 'HEAD', 'POST'].includes(method)) return false
  return method !== 'POST' || !/(?:apply|submit|application|register|login|upload|delete|logout)/i.test(url.pathname)
}
