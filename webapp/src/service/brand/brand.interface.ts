/**
 * service/brand/brand.interface.ts
 *
 * 品牌信息契约. 单一来源: config/brand.ts (换产品改配置即可, 引用方不动).
 * 提供品牌文案 / logo / 问候语, 供 settings 头像、欢迎页等消费.
 */

export interface BrandInfo {
  /** 品牌名 (e.g. 'Numas') */
  name: string;
  /** 品牌标题 */
  title: string;
  /** 副标题 / slogan */
  subtitle: string;
  /** 问候语 */
  greeting: string;
  /** 品牌 logo (emoji 或 url) */
  logo: string;
}

export interface IBrandService {
  /** 当前品牌信息 (读 config/brand.ts 单一来源) */
  getBrand(): BrandInfo;
}

export const BrandToken: symbol = Symbol('IBrandService');
