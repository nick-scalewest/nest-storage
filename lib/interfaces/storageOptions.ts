import { ModuleMetadata, Type } from "@nestjs/common/interfaces";
import { ClientOptions as MinioClientOptions } from 'minio';

export interface DiskOptions {
  driver: "s3" | "local" | "minio";
  profile?: string;
  region?: string;
  bucket?: string;
  prefix?: string;
  basePath?: string;
  minioOptions?: MinioClientOptions;
  debug?: boolean
}

export interface StorageOptions {
  default?: string;
  disks: Record<string, DiskOptions>;
}

export interface StorageOptionsFactory {
  createStorageOptions(): Promise<StorageOptions> | StorageOptions;
}

export interface StorageAsyncOptions extends Pick<ModuleMetadata, "imports"> {
  name?: string;
  useExisting?: Type<StorageOptions>;
  useClass?: Type<StorageOptions>;
  useFactory?: (...args: any[]) => Promise<StorageOptions> | StorageOptions;
  inject?: any[];
}
