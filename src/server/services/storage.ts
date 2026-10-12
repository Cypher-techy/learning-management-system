import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import { AppError } from "../errors";

export type DownloadOptions = {
  filename: string;
  contentType: string;
  /** Force a download dialog instead of inline display. */
  attachment: boolean;
};

export type LocalRead = {
  stream: ReadableStream<Uint8Array>;
  size: number;
  start: number;
  end: number;
  partial: boolean;
};

export interface StorageDriver {
  readonly kind: "local" | "s3";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Short-lived URL for private objects (remote drivers only). */
  signedUrl?(key: string, options: DownloadOptions, expiresInSeconds: number): Promise<string>;
  /** Streaming read (local driver only). */
  read?(key: string, range?: { start: number; end?: number }): Promise<LocalRead>;
}

const SAFE_KEY = /^[a-z_]+\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/;

function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key)) throw new Error("Refusing to use an unexpected storage key.");
}

class LocalDriver implements StorageDriver {
  readonly kind = "local" as const;
  constructor(private readonly root: string) {}

  private resolve(key: string) {
    assertSafeKey(key);
    return path.join(this.root, ...key.split("/"));
  }

  async put(key: string, body: Buffer) {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }

  async read(key: string, range?: { start: number; end?: number }): Promise<LocalRead> {
    const target = this.resolve(key);
    const info = await stat(target).catch(() => null);
    if (!info) throw new AppError("NOT_FOUND", "The file is no longer available.");
    const size = info.size;
    const start = range ? Math.min(Math.max(range.start, 0), Math.max(size - 1, 0)) : 0;
    const end = range?.end !== undefined ? Math.min(range.end, size - 1) : size - 1;
    const stream = Readable.toWeb(
      createReadStream(target, { start, end: Math.max(end, start) }),
    ) as unknown as ReadableStream<Uint8Array>;
    return { stream, size, start, end, partial: !!range };
  }
}

class S3Driver implements StorageDriver {
  readonly kind = "s3" as const;
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    options: {
      endpoint?: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      forcePathStyle: boolean;
    },
  ) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async delete(key: string) {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signedUrl(key: string, options: DownloadOptions, expiresInSeconds: number) {
    assertSafeKey(key);
    const disposition = `${options.attachment ? "attachment" : "inline"}; filename="${options.filename.replace(/[^\w.\- ]/g, "_")}"`;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: disposition,
        ResponseContentType: options.contentType,
      }),
      { expiresIn: expiresInSeconds },
    );
  }
}

let driver: StorageDriver | undefined;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  if (e.STORAGE_DRIVER === "s3") {
    if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) {
      throw new AppError(
        "UNAVAILABLE",
        "File storage is not configured. Set the S3_* environment variables.",
      );
    }
    driver = new S3Driver(e.S3_BUCKET, {
      endpoint: e.S3_ENDPOINT,
      region: e.S3_REGION,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
    });
  } else {
    // The directory is outside the bundle; tell the bundler not to trace it.
    driver = new LocalDriver(path.resolve(/* turbopackIgnore: true */ process.cwd(), e.STORAGE_LOCAL_DIR));
  }
  return driver;
}

/** Test hook. */
export function setStorage(next: StorageDriver | undefined) {
  driver = next;
}

export function storageStatus(): { driver: string; durable: boolean; note: string } {
  const e = env();
  if (e.STORAGE_DRIVER === "s3") {
    const ready = !!(e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY);
    return {
      driver: "s3",
      durable: ready,
      note: ready ? "S3-compatible object storage is configured." : "S3 credentials are missing.",
    };
  }
  return {
    driver: "local",
    durable: false,
    note: "Local disk storage. Suitable for development only; not durable on serverless hosts.",
  };
}
