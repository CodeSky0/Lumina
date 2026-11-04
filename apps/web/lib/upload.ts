import type { MessageMetadata, Upload } from "@/lib/types";

export function uploadMessageFields(upload: Upload, file: File): { fileName: string; metadata: MessageMetadata } {
  const fileName = upload.original_name || file.name;
  return {
    fileName,
    metadata: { file_id: upload.id, file_name: fileName, mime_type: upload.mime, size: upload.size },
  };
}
