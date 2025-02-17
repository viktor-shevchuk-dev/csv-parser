import { Transform, TransformCallback } from "stream";

import { JsonApiResponse } from "../types";

export class Monitor extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: true });
  }

  _transform(
    chunk: { value: JsonApiResponse },
    _encoding: BufferEncoding,
    callback: TransformCallback
  ) {
    const used = process.memoryUsage();
    console.log(
      `Processing chunk - Heap Used: ${Math.round(
        used.heapUsed / 1024 / 1024
      )} MB`
    );
    // console.log(chunk);
    this.push(chunk);
    callback();
  }
}
