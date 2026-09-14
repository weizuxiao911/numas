/**
 * service/brand/brand.service.ts
 *
 * BrandServiceImpl — DI 单例. 品牌信息的唯一读取入口.
 * 数据来自 config/brand.ts (单一来源), 换产品改配置即可.
 */

import { Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { APP_CHAT_CONFIG } from '../../config/brand';

import type { BrandInfo, IBrandService } from './brand.interface';
import { BrandToken } from './brand.interface';

@Injectable()
export class BrandServiceImpl implements IBrandService {
  getBrand(): BrandInfo {
    return { ...APP_CHAT_CONFIG.brand };
  }
}

@Injectable()
export class BrandModule extends BrowserModule {
  providers = [
    { token: BrandToken, useClass: BrandServiceImpl },
    BrandServiceImpl,
  ];
}
