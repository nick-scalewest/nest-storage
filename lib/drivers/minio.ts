import {
  DiskOptions,
  FileOptions,
  StorageDriver,
  StorageDriver$FileMetadataResponse,
  StorageDriver$PutFileResponse,
  StorageDriver$RenameFileResponse,
} from "../interfaces";
import { getMimeFromExtension } from "../helpers";

import * as minio from "minio";
import { Client, ClientOptions, ItemBucketMetadata } from "minio";

export class Minio implements StorageDriver {
  private readonly disk: string;
  private config: DiskOptions;
  private client: Client;

  constructor(disk: string, config: DiskOptions) {
    this.disk = disk;
    this.config = config;

    this.client = new minio.Client(<ClientOptions>config.minioOptions);
  }

  /**
   * Put file content to the path specified.
   *
   * @param path
   * @param fileContent
   */
  async put(
    path: string,
    fileContent: any,
    options?: FileOptions
  ): Promise<StorageDriver$PutFileResponse> {
    const { mimeType } = options || {};


    const metaData: ItemBucketMetadata = {
      'Content-Type': mimeType ? mimeType : getMimeFromExtension(path),
    };

    const res = await this.client.putObject(<string>this.config.bucket, path, fileContent, metaData);

    return {
      url: await this.url(path),
      path
    }
  }

  /**
   * Get Signed Urls
   * @param path
   */
  async signedUrl(path: string, expireInMinutes = 24*60*60*7): Promise<string> {
    return await this.client.presignedGetObject(<string>this.config.bucket, path, expireInMinutes);
  }

  /**
   * Get file stored at the specified path.
   *
   * @param path
   */
  async get(path: string): Promise<Buffer | null> {
    try {
      const readableStream = await this.client.getObject(<string>this.config.bucket, path);

      const buffers = [];
      // node.js readable streams implement the async iterator protocol
      for await (const data of readableStream) {
        buffers.push(data);
      }

      return Buffer.concat(buffers);

    } catch (e) {
      return null;
    }
  }

  /**
   * Check if file exists at the path.
   *
   * @param path
   */
  async exists(path: string): Promise<boolean> {
    const meta = await this.meta(path);
    return Object.keys(meta).length > 0;
  }

  /**
   * Get object's metadata
   * @param path
   */
  async meta(path: string): Promise<StorageDriver$FileMetadataResponse> {

    try {
      const res = await this.client.statObject(<string>this.config.bucket, path);
      return {
        path: path,
        contentType: res.metaData?.ContentType,
        contentLength: res.size,
        lastModified: res.lastModified,
        etag: res.etag
      };
    } catch (e) {
      return {};
    }
  }

  /**
   * Check if file is missing at the path.
   *
   * @param path
   */
  async missing(path: string): Promise<boolean> {
    const meta = await this.meta(path);
    return Object.keys(meta).length === 0;
  }

  /**
   * Get URL for path mentioned.
   *
   * @param path
   */
  async url(path: string): Promise<string> {
    return await this.signedUrl(path, 24*60*60*7);
  }

  /**
   * Delete file at the given path.
   *
   * @param path
   */
  async delete(path: string): Promise<boolean> {
    try {
      await this.client.removeObject(<string>this.config.bucket, path);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Copy file internally in the same disk
   *
   * @param path
   * @param newPath
   */
  async copy(
    path: string,
    newPath: string
  ): Promise<StorageDriver$RenameFileResponse> {
    const source = await this.meta(path);
    const conds = new minio.CopyConditions()
    conds.setMatchETag(<string>source.etag);
    await this.client.copyObject(<string>this.config.bucket, newPath, `/${this.config.bucket}/${path}`, conds);

    return {
      path: newPath,
      url: await this.url(newPath)
    };
  }

  /**
   * Move file internally in the same disk
   *
   * @param path
   * @param newPath
   */
  async move(
    path: string,
    newPath: string
  ): Promise<StorageDriver$RenameFileResponse> {
    await this.copy(path, newPath);
    await this.delete(path);
    return {
      path: newPath,
      url: await this.url(newPath)
    };
  }

  /**
   * Get instance of driver's client.
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Get config of the driver's instance.
   */
  getConfig(): Record<string, any> {
    return this.config;
  }

  async toBuffer(stream: ReadableStream<Uint8Array>) {
    const list = []
    const reader = stream.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (value)
        list.push(value)
      if (done)
        break
    }
    return Buffer.concat(list)
  }
}
