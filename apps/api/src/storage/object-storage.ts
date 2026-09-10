export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

export interface ObjectStorage {
  putObject(key: string, data: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<{ data: Buffer; contentType: string }>;
}
